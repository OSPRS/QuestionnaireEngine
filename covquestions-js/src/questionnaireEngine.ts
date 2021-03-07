import * as jsonLogic from "json-logic-js";

import {
  Question,
  Questionnaire,
  QuestionWithOptions,
  ResultCategory,
  Variable,
} from "./models/Questionnaire.generated";
import { convertToPrimitiveArray, Primitive } from "./primitive";

export type Result = {
  resultCategory: { id: string; description: string };
  result: { id: string; text: string };
};

type ScoreResponse = {
  [k: string]: number;
};

type OptionResponse = { [optionId: string]: boolean };

type AnswerFromOptions = {
  selected_count: number;
  count: number;
  unselected_count: number;
  option: OptionResponse;
  score: ScoreResponse;
};

type DataObjectEntry = AnswerFromOptions | RawAnswer | ScoreResponse;

type GivenAnswer = {
  questionId: string;
  rawAnswer: RawAnswer;
};

type RawAnswer = Primitive | Primitive[] | undefined;

type AnswersPersistence = {
  answers: GivenAnswer[];
  version: number;
  timeOfExecution?: number;
};

export class QuestionnaireEngine {
  private readonly questionnaire: Questionnaire;
  private readonly questions: Question[] = [];
  private variables: Variable[] = [];
  private resultCategories: ResultCategory[] = [];
  private data: { [key: string]: DataObjectEntry } = {};
  private readonly timeOfExecution?: number;
  private givenAnswers: GivenAnswer[] = [];

  constructor(newQuestionnaire: Questionnaire, timeOfExecution?: number) {
    this.questionnaire = newQuestionnaire;
    this.questions = newQuestionnaire.questions;
    this.variables = newQuestionnaire.variables;
    this.resultCategories = newQuestionnaire.resultCategories;
    this.timeOfExecution = timeOfExecution;
  }

  public nextQuestion(): Question | undefined {
    const indexOfNextQuestion = this.questions.findIndex(
      ({ enableWhenExpression }, index) => {
        const isAfterCurrentQuestion = index > this.getCurrentQuestionIndex();
        const isEnabled =
          enableWhenExpression === undefined ||
          jsonLogic.apply(enableWhenExpression, this.data);
        return isAfterCurrentQuestion && isEnabled;
      }
    );

    if (indexOfNextQuestion > -1) {
      return this.questions[indexOfNextQuestion];
    }

    return undefined;
  }

  public previousQuestion(
    currentQuestionId: string
  ): { question: Question; answer?: RawAnswer } {
    this.removeAnswersStartingFrom(currentQuestionId);
    const previousAnswer = this.givenAnswers.pop();
    this.recreateDataObject();

    const previousQuestion = this.nextQuestion() ?? this.questions[0]!;

    if (previousQuestion.id === previousAnswer?.questionId) {
      return { question: previousQuestion, answer: previousAnswer.rawAnswer };
    }
    return { question: previousQuestion };
  }

  public getAnswersPersistence(): AnswersPersistence {
    return { answers: this.givenAnswers, version: this.questionnaire.version };
  }

  public setAnswersPersistence(answersPersistence: AnswersPersistence) {
    this.givenAnswers = answersPersistence.answers;
    this.recreateDataObject();
  }

  public setAnswer(questionId: string, rawAnswer: RawAnswer) {
    const question = this.getQuestionById(questionId);
    if (question === undefined) {
      throw new Error(
        `You cannot set the answer to a question that does not exist. QuestionId: ${questionId}`
      );
    }

    if (!question.optional && rawAnswer === undefined) {
      throw new Error(`This question is not optional: ${questionId}`);
    }

    this.removeAnswersStartingFrom(questionId);

    this.givenAnswers.push({
      questionId: questionId,
      rawAnswer,
    });

    this.recreateDataObject();
  }

  private removeAnswersStartingFrom(questionId: string) {
    const indexOfAnswer = this.givenAnswers.findIndex(
      (answer) => answer.questionId === questionId
    );

    if (indexOfAnswer > -1) {
      this.givenAnswers = this.givenAnswers.slice(0, indexOfAnswer);
    }
  }

  public getProgress(): number {
    return (this.getCurrentQuestionIndex() + 1) / this.questions.length;
  }

  private getCurrentQuestionIndex(): number {
    return this.questions.findIndex(
      ({ id }) => id === this.getCurrentQuestionId()
    );
  }

  private getCurrentQuestionId(): string | undefined {
    const lastAnswer = this.givenAnswers[this.givenAnswers.length - 1];
    return lastAnswer?.questionId;
  }

  private processAnswerWithOptions(
    rawAnswer: RawAnswer,
    question: QuestionWithOptions
  ): AnswerFromOptions {
    const valueAsArray = convertToPrimitiveArray(rawAnswer);

    const count = question.options !== undefined ? question.options.length : 0;
    const selected_count = valueAsArray.length;
    const unselected_count = count - selected_count;

    const optionResponse: OptionResponse = {};
    let score: ScoreResponse = {};
    for (const option of question.options || []) {
      const isSelected = valueAsArray.indexOf(option.value) > -1;
      optionResponse[option.value] = isSelected;
      if (isSelected) {
        score = this.mergeScores(score, option.scores);
      }
    }

    return {
      count,
      selected_count,
      unselected_count,
      option: optionResponse,
      score,
    };
  }

  private mergeScores(
    scores1?: ScoreResponse,
    scores2?: ScoreResponse
  ): ScoreResponse {
    const combinedScores = scores1 ?? {};
    Object.entries(scores2 ?? {}).forEach(([scoreId, score]) => {
      combinedScores[scoreId] = (combinedScores[scoreId] ?? 0) + score;
    });
    return combinedScores;
  }

  private getQuestionById(questionId: string): Question | undefined {
    return this.questions.find((question) => question.id === questionId);
  }

  private recreateDataObject() {
    this.data = {};
    this.data["now"] = Math.round(this.timeOfExecution || Date.now() / 1000);

    const answersFromOptionQuestions: AnswerFromOptions[] = [];

    this.givenAnswers.forEach(({ questionId, rawAnswer }) => {
      const question = this.questions.find(({ id }) => id === questionId);

      if (question?.type === "multiselect" || question?.type === "select") {
        const processedAnswer = this.processAnswerWithOptions(
          rawAnswer,
          question
        );
        answersFromOptionQuestions.push(processedAnswer);
        this.data[questionId] = processedAnswer;
      } else {
        this.data[questionId] = rawAnswer;
      }
    });

    this.data.score = answersFromOptionQuestions.reduce<ScoreResponse>(
      (prev, curr) => this.mergeScores(prev, curr.score),
      {}
    );

    this.variables.forEach((variable) => {
      try {
        this.data[variable.id] = jsonLogic.apply(
          variable.expression,
          this.data
        );
      } catch (e) {}
    });
  }

  public getDataObjectForDeveloping(): any {
    return this.data;
  }

  public getResults(): Result[] {
    this.recreateDataObject();
    const results = this.resultCategories.map((resultCategory) => {
      const resultInCategory = resultCategory.results.find((possibleResult) =>
        jsonLogic.apply(possibleResult.expression, this.data)
      );
      if (resultInCategory !== undefined) {
        return {
          resultCategory: {
            id: resultCategory.id,
            description: resultCategory.description,
          },
          result: { id: resultInCategory.id, text: resultInCategory.text },
        };
      } else {
        return undefined;
      }
    });
    return results.filter(notUndefined);
  }
}

function notUndefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}