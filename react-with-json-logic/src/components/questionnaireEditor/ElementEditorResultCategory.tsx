import { ElementEditor } from "./ElementEditor";
import React from "react";
import resultCategorySchema from "./formEditorSchemas/resultCategory.json";
import { EditorResult, EditorResultCategory } from "../../models/editorQuestionnaire";
import { convertLogicExpressionToString } from "./converters";
import { RootState, useAppDispatch } from "../../store/store";
import { useSelector } from "react-redux";
import { editResultCategory, resultCategoryInEditorSelector } from "../../store/questionnaireInEditor";
import { uiSchemaLogic, uiSchemaLogicReadOnly } from "./formEditorSchemas/uiSchemaLogic";

type ResultInStringRepresentation = Omit<EditorResult, "expression"> & { expression: string };
export type ResultCategoryInStringRepresentation = Omit<EditorResultCategory, "results"> & {
  results: ResultInStringRepresentation[];
};

type ElementEditorResultProps = {
  index: number;
};

const uiSchema = {
  "ui:order": ["", "", "*"],
  results: {
    items: {
      "ui:order": ["id", "text", "expressionString", "*"],
      expression: uiSchemaLogicReadOnly(),
      expressionString: uiSchemaLogic(),
    },
  },
};

function convertToStringRepresentation(formData: EditorResultCategory): ResultCategoryInStringRepresentation {
  return {
    ...formData,
    results: formData?.results?.map((result) => {
      let expression = JSON.stringify(result.expression, null, 2);
      return { ...result, expression };
    }),
  };
}

export function ElementEditorResultCategory(props: ElementEditorResultProps) {
  const dispatch = useAppDispatch();

  const resultCategory = useSelector((state: RootState) => resultCategoryInEditorSelector(state, props));

  const onChange = (formData: ResultCategoryInStringRepresentation, hasErrors: boolean) => {
    dispatch(editResultCategory({ index: props.index, changedResultCategory: formData, hasErrors: hasErrors }));
  };

  return (
    <ElementEditor
      schema={resultCategorySchema as any}
      formData={convertToStringRepresentation(resultCategory)}
      onChange={onChange}
      uiSchema={uiSchema}
    />
  );
}
