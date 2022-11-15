Quicklinks: [Documents](https://drive.google.com/drive/folders/1YpAaD8_mvSkpHuIvbIJmsb08GLVQt8iE?usp=sharing) | [OpenAPI Spec](https://covopen.github.io/CovQuestions/swagger/index.html)

# Questionnaire Engine

This project provides a way to maintain and quickly adapt complex Questionnaires and their evaluation in mutliple languages and versions. It also provides a javascript engine to run those Questionnaires in any environment, e.g. on a website, telephone-hotline or chatbot.

## Structure

### [Web-based Integrated Development Interface (IDE)](/covquestions-editor-app/README.md) ([Demo](https://covquestions.z16.web.core.windows.net/))

The web-based IDE allows to create, update and test a questionnaire and recommendation logic.
You can define questions and logic to display specfic questions depending on answers from others or a scoring logic.
At the end the questionnaire personalized recommendations are created.
All of this can be tested manually and automatically in the IDE.

### [Questionnaire Engine](./covquestions-js/README.md) ([Docu](https://covopen.github.io/CovQuestions/))

The Engine allows you to run any specified questionnaire interactively.

#### [Script Language](./covscript/README.md)

A custom parser to make it easier to work with `json-logic` which we use under the hood for the questionnaire logic.

### [Questionnaire API](/api/README.md) ([Live Documentation](https://covopen.github.io/CovQuestions/swagger/index.html))

The API supplies all questionnaires in a static way, versioned and in multiple languages.

# Contribute

Have a look at our [CONTRIBUTING.md](/CONTRIBUTING.md) to get started.
