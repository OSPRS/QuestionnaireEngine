import * as fs from 'fs-extra';
import { convert } from 'xmlbuilder2';
import * as glob from 'fast-glob';
import { validate } from '../src/validate';
import { SOURCE_PATHS } from '../src/index';
import {
  md5,
  doOnEachTranslation,
  getStringRessource,
  TranslationMap,
  readI18nFile,
  replaceTranslationMap,
} from '../src/utility';
import { Questionnaire } from '../src/models/Questionnaire.generated';

const defaultFile = 'translation.en.xlf';

const xmlBase = {
  xliff: {
    '@version': '1.2',
    file: {
      '@datatype': 'plaintext',
      '@source-language': 'en',
      body: {},
    },
  },
};

export function i18n_extract(
  questionnaire: Questionnaire
): { questionnaire: Questionnaire; sourceMap: TranslationMap } {
  // Goes through each file and extracts the
  const tranlationMap: TranslationMap = {};

  const newfile = doOnEachTranslation(questionnaire, (key, value, obj) => {
    addTranslationToMap(tranlationMap, obj[key], obj, key);
  });
  return { questionnaire: newfile, sourceMap: tranlationMap };
}

export function writeI18nFile(
  path: string,
  targetLang: string,
  sourceMap: TranslationMap,
  targetMap: TranslationMap = sourceMap
) {
  xmlBase.xliff.file.body['trans-unit'] = Object.keys(sourceMap).map((key) => {
    return {
      '@id': key,
      source: sourceMap[key],
      target: {
        '@state': 'translated',
        '#': targetMap[key],
      },
    };
  });
  xmlBase.xliff.file['@target-language'] = targetLang;
  fs.outputFileSync(path, convert(xmlBase, { prettyPrint: true }));
}

export function addTranslationToMap(map: TranslationMap, str: string, obj: Object, key: string) {
  // We should't use md5 from source, if source is updated all other references are lost.
  // TODO: Make sure every object with strings for translation has a unqiue id (this makes reusing the objects easier aswell)
  let [trans, id] = getStringRessource(str);
  if (id != null) {
    str = trans;
  } else {
    id = md5(str);
    obj[key] = `${str}@@${id}`;
  }
  if (map[id] != null && map[id] !== str) {
    throw new Error(`Different Translations detected.`);
  }
  map[id] = str;
}

/**
 * Gets all Files from the `inputGlob` for each file it:
 *  - Extracts the text which should be translated and generates unique ids
 *  - Adds the new translations to the questionnaires main `i18n` files or creates it.
 *  - Creates the questionnaire file in the `data` structure
 * Attention: It does not create the local translation files.
 * @param inputGlob Input Folder, where to import the questionnaire from
 * @param outDir The data Folder, where the consolidated Questionnaires are versioned
 */
export function pre_build_add_new_file(inputGlob = './input/*.json', outDir = './src/data') {
  let newQuestionnairePaths = glob.sync(inputGlob);
  newQuestionnairePaths.forEach((q) => validate(q));

  newQuestionnairePaths.forEach((path) => {
    let srcQuestionnaire = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' })) as Questionnaire;
    let dataQuestionnairePath = `${outDir}${SOURCE_PATHS.QUESTIONNAIRES}/${srcQuestionnaire.id}/`;
    let dataI18nMainFile = `${dataQuestionnairePath}i18n/${defaultFile}`;
    let dataPath = `${dataQuestionnairePath}${srcQuestionnaire.version}/${srcQuestionnaire.id}-${srcQuestionnaire.version}.json`;

    // Checks
    if (fs.existsSync(dataPath)) {
      throw new Error(
        `Questionnaire "${srcQuestionnaire.id}" in version "${srcQuestionnaire.version}" already exists.`
      );
    }

    // Append or create translations to Main Translation File
    let previousTranslations: TranslationMap = {};
    if (fs.existsSync(dataI18nMainFile)) {
      let test = readI18nFile(dataI18nMainFile)[0];
      previousTranslations = test;
    }

    let { questionnaire, sourceMap } = i18n_extract(srcQuestionnaire);

    fs.outputFileSync(dataPath, JSON.stringify(questionnaire, null, 2));
    writeI18nFile(dataI18nMainFile, 'en', { ...previousTranslations, ...sourceMap });
  });

  // Delete Files in Input
  newQuestionnairePaths.forEach((f) => fs.removeSync(f));
}

/**
 * Creates the local translation files for all questionnaires which don't have them.
 * It uses the main translation files of a questionnaire to generate them.
 *
 * Future: Provide a way to create a new version with updated translations.
 * @param dataDir Path to the data directory.
 */
export function pre_build_fixate_translations(dataDir = './src/data') {
  let allQuestionnaires = glob.sync(`${dataDir}/**/*.json`);
  allQuestionnaires.forEach((questionnairePath) => {
    let questionnaire = JSON.parse(fs.readFileSync(questionnairePath, { encoding: 'utf-8' })) as Questionnaire;
    // Example "data/questionnaires/questionnaireId"
    let questionnaireDir = questionnairePath.split('/').slice(0, -2).join('/');
    // Example "data/questionnaires/questionnaireId/version/"
    let versionedDir = `${questionnaireDir}/${questionnaire.version}/`;
    // Example "data/questionnaires/questionnaireId/i18n"
    let mainI18nDir = `${questionnaireDir}/i18n/`;
    let mainI18nFilePaths = glob.sync(`${mainI18nDir}*.xlf`);

    let fixedI18nFiles = glob.sync(`${versionedDir}*.xlf`);
    if (fixedI18nFiles.length === 0) {
      let { sourceMap } = i18n_extract(questionnaire);
      mainI18nFilePaths.forEach((transFilePath) => {
        let { source, target, lang } = readI18nFile(transFilePath);
        let filteredSourceMap = replaceTranslationMap(sourceMap, source);
        let filteredTargetMap = replaceTranslationMap(sourceMap, target);

        writeI18nFile(
          `${questionnairePath.split('.').slice(0, -1).join('.')}.${lang}.xlf`,
          lang,
          filteredSourceMap,
          filteredTargetMap
        );
      });
    }
  });
}

pre_build_add_new_file();
pre_build_fixate_translations();
