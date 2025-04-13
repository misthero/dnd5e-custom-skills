const MODULE_NAME = 'dnd5e-custom-skills';

Handlebars.registerHelper("csFormat", (path, ...args) => {
  return game.i18n.format(path, args[0].hash);
});

Handlebars.registerHelper("inObject", (object, value) => {
  if (typeof object != 'undefined')
    return Object.values(object).includes(value)
  return false;
});

let dndV3 = false;

var compareVersions = function (a, b) {
  const versionA = a.split('.').map(Number);
  const versionB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
    const numA = versionA[i] || 0;
    const numB = versionB[i] || 0;

    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}



/**
 *  ▄▀▀░█▒█░▄▀▀░▀█▀░▄▀▄░█▄▒▄█░░░▄▀▀░█▄▀░█░█▒░░█▒░░▄▀▀░░▒▄▀▄▒█▀▄▒█▀▄░█▒░░█░▄▀▀▒▄▀▄░▀█▀░█░▄▀▄░█▄░█░░░▄▀▀▒██▀░▀█▀░▀█▀░█░█▄░█░▄▀▒░▄▀▀░░▒█▀░▄▀▄▒█▀▄░█▄▒▄█
░*  ▀▄▄░▀▄█▒▄██░▒█▒░▀▄▀░█▒▀▒█▒░▒▄██░█▒█░█▒█▄▄▒█▄▄▒▄██▒░░█▀█░█▀▒░█▀▒▒█▄▄░█░▀▄▄░█▀█░▒█▒░█░▀▄▀░█▒▀█▒░▒▄██░█▄▄░▒█▒░▒█▒░█░█▒▀█░▀▄█▒▄██▒░░█▀░▀▄▀░█▀▄░█▒▀▒█
 */

class CustomSkillsForm extends FormApplication {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize(MODULE_NAME + '.form-title'),
      id: 'skills-form',
      template: `modules/${MODULE_NAME}/templates/skills-config.html`,
      width: 700,
      closeOnSubmit: false,
      requiresReload: true
    });
  }

  getData(options) {
    let data = foundry.utils.mergeObject({
      abilities: CONFIG.DND5E.abilities,
      skills: CONFIG.DND5E.skills
    },
      this.reset ? foundry.utils.mergeObject(CustomSkills.defaultSettings, {
        requireSave: true
      }) : foundry.utils.mergeObject(CustomSkills.settings, {
        requireSave: false
      }));
    this.reset = false;
    return data;
  }



  onReset() {
    this.reset = true;
    game.settings.set(MODULE_NAME, 'settings', {});
    ui.notifications.info(game.i18n.localize(MODULE_NAME + '.afterReset'));
    this.render();
  }

  async _updateObject(event, formData) {
    let Form = foundry.utils.mergeObject({}, formData, {
      insertKeys: true,
      insertValues: true,
      overwrite: true
    });
    const oldSettings = CustomSkills.settings;

    let newSkills = {};
    let newAbilities = {};
    let newSettings = foundry.utils.mergeObject(oldSettings, Form);

    // check if skills have been removed
    if (Form.skillNum < CustomSkills.countObject(oldSettings.customSkillList)) {
      let count = 0;
      for (let a in Form.customSkillList) {
        if (count < Form.skillNum) {
          newSkills[a] = Form.customSkillList[a];
          count++;
        }
      }
      newSettings.customAbilitiesList = newSkills;
    } else {
      newSkills = Form.customSkillList;
    }

    // check if abilities have been removed
    if (Form.abilitiesNum < CustomSkills.countObject(oldSettings.customAbilitiesList)) {
      let count = 0;
      for (let a in Form.customAbilitiesList) {
        if (count < Form.abilitiesNum) {
          newAbilities[a] = Form.customAbilitiesList[a];
          count++;
        }
      }
      newSettings.customAbilitiesList = newAbilities;
    } else {
      newAbilities = Form.customAbilitiesList;
    }

    // update settings
    await game.settings.set(MODULE_NAME, 'settings', newSettings);

    // modify system variables
    CustomSkills.applyToSystem();

    await CustomSkills.updateActors(newSkills, newAbilities);

    SettingsConfig.reloadConfirm({ world: true });

    return this.render();
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="reset"]').click(this.onReset.bind(this));
  }

  async _onChangeInput(event) {
    const elem = $(event.originalEvent.target);
    const container = super.element;

    // enable skill
    if (elem.hasClass('apply_skill')) {
      const skillCode = elem.data('skill');
      if (elem.prop('checked')) {
        $('select#select_' + skillCode, container).attr('disabled', 'disabled');
        $('input[name="fakeSkillList.' + skillCode + '.label"]', container).attr('readonly', 'readonly');
      } else {
        $('select#select_' + skillCode, container).removeAttr('disabled');
        $('input[name="fakeSkillList.' + skillCode + '.label"]', container).removeAttr('readonly');
      }
    }

    // fill hidden skill input
    if (elem.hasClass('skill-label-capture')) {
      const skillKey = elem.data('key');
      $('input[name="customSkillList.' + skillKey + '.label"]', container).val(elem.val());
    }

    // enable ability
    if (elem.hasClass('apply_ability')) {
      const abilityCode = elem.data('ability');
      if (elem.prop('checked')) {
        $('input[name="fakeAbilityLabel.' + abilityCode + '.label"]', container).attr('readonly', 'readonly');
      } else {
        $('input[name="fakeAbilityLabel.' + abilityCode + '.label"]', container).removeAttr('readonly');
      }
    }

    // fill hidden ability input
    if (elem.hasClass('ability-label-capture')) {
      const abilityKey = elem.data('key');
      $('input[name="customAbilitiesList.' + abilityKey + '.label"]', container).val(elem.val());
    }

    // fill hidden skill ability from select
    if (elem.hasClass('ability_select')) {
      const selected = elem.find('option:selected').val();
      const skillCode = elem.data('skill');
      $('input[name="customSkillList.' + skillCode + '.ability"]').val(selected);
    }
  }

} /** end CustomSkillsForm **/

/*
 * ░█░█▄░█░█░▀█▀░░░█▄█░▄▀▄░▄▀▄░█▄▀
 * ░█░█▒▀█░█░▒█▒▒░▒█▒█░▀▄▀░▀▄▀░█▒█
 */
Hooks.on('init', () => {
  //console.log('dnd5e-custom-skills init');
  //CONFIG.debug.hooks = true;
  if (typeof game.dnd5e.version === 'string') {
    dndV3 = foundry.utils.isNewerVersion(game.dnd5e.version, '2.99.99');
  }

  game.settings.registerMenu(MODULE_NAME, MODULE_NAME, {
    name: MODULE_NAME + ".form",
    label: MODULE_NAME + ".form-title",
    hint: MODULE_NAME + ".form-hint",
    icon: "fas fa-cog",
    type: CustomSkillsForm,
    scope: "world",
    restricted: true
  });

  game.settings.register(MODULE_NAME, "settings", {
    name: "Custom Skills Settings",
    scope: "world",
    default:
      CustomSkills.defaultSettings,
    type: Object,
    config: false,
    //onChange: (x) => window.location.reload()
  });

  window._isDaeActive = false;
  for (const mod of game.data.modules) {
    if (mod.id == "dae" && mod.active) {
      window._isDaeActive = true;
      break;
    }
  }

  window.dnd5eCustomSkills = function (action, params, apply) {
    const results = CustomSkills._integration(action, params, apply);
    if (typeof results.then === "function") {
      return results.then((result) => {
        return result
      });
    } else {
      return results;
    }
  };
  CustomSkills.applyToSystem();
});

/*
 *░▄▀▀░█▒█░▄▀▀░▀█▀░▄▀▄░█▄▒▄█░░░▄▀▀░█▄▀░█░█▒░░█▒░░░░▄▀▀░█▒░▒▄▀▄░▄▀▀░▄▀▀
 *░▀▄▄░▀▄█▒▄██░▒█▒░▀▄▀░█▒▀▒█▒░▒▄██░█▒█░█▒█▄▄▒█▄▄▒░░▀▄▄▒█▄▄░█▀█▒▄██▒▄██
 */

class CustomSkills {
  static get settings() {
    let csSettings = foundry.utils.mergeObject(this.defaultSettings, game.settings.get(MODULE_NAME, 'settings'));
    // skills
    const oldSkillNum = this.countObject(csSettings.customSkillList);
    const oldAbilityNum = this.countObject(csSettings.customAbilitiesList);

    if (csSettings.skillNum > oldSkillNum) {
      // there are more skills than before
      let skills = {};
      for (let n = oldSkillNum; n < csSettings.skillNum; n++) {
        let name = 'cus_' + n;
        skills[name] = this.getBaseSkill();
      }
      csSettings.customSkillList = foundry.utils.mergeObject(csSettings.customSkillList, skills);
    } else if (csSettings.skillNum < oldSkillNum) {
      //there are less skills than before, need to delete some
      for (let n = (oldSkillNum - 1); n >= csSettings.skillNum; n--) {
        let name = 'cus_' + n;
        delete csSettings.customSkillList[name];
      }
    }

    if (csSettings.abilitiesNum > oldAbilityNum) {
      // there are more abilities than before
      let abilities = {};
      for (let n = oldAbilityNum; n < csSettings.abilitiesNum; n++) {
        let name = 'cua_' + n;
        abilities[name] = this.getBaseAbility(false);
      }
      csSettings.customAbilitiesList = foundry.utils.mergeObject(csSettings.customAbilitiesList, abilities);
    } else if (csSettings.abilitiesNum < oldAbilityNum) {
      //there are less abilities than before, need to delete some
      for (let n = (oldAbilityNum - 1); n >= csSettings.abilitiesNum; n--) {
        let name = 'cua_' + n;
        delete csSettings.customAbilitiesList[name];
      }
    }

    return csSettings;
  }

  /**
   * Get default settings object.
   */
  static get defaultSettings() {
    /** skills **/
    const skillNum = 5;
    let skills = {};
    for (let n = 0; n < skillNum; n++) {
      let name = 'cus_' + n;
      skills[name] = this.getBaseSkill();
    };

    /** abilities **/
    const abilitiesNum = 2;
    let abilities = {};
    for (let n = 0; n < abilitiesNum; n++) {
      let name = 'cua_' + n;
      abilities[name] = this.getBaseAbility(false);
    };

    //console.log('dnd5e-custom-skills.defaultSettings', skills, abilities);

    return {
      customSkillList: skills,
      skillNum: skillNum,
      customAbilitiesList: abilities,
      abilitiesNum: abilitiesNum,
      hiddenAbilities: {},
      hiddenSkills: {}
    };
  }

  static getBaseSkill() {
    let skill;
    if (dndV3) {
      skill = foundry.utils.deepClone(game.system.config.skills.acr);
      skill.icon = "";
      skill.reference = "";
    } else {
      skill = foundry.utils.deepClone(game.system.template.Actor.templates.creature.skills.acr);
    }
    return skill;

  }

  static getBaseAbility(applied, label) {
    let cleanAbility;
    if (dndV3) {
      cleanAbility = foundry.utils.deepClone(game.system.config.abilities.cha);
    } else {
      cleanAbility = foundry.utils.deepClone(game.system.template.Actor.templates.common.abilities.cha);
    }

    //console.log('dnd5e-custom-skills.getBaseAbility', cleanAbility);

    cleanAbility.type = "physical";
    cleanAbility.reference = "";
    if (typeof applied === 'undefined') {
      cleanAbility.applied = false;
    } else {
      cleanAbility.applied = applied;
    }

    if (typeof label === 'undefined') {
      // keep default label
    } else {
      cleanAbility.label = label;
      cleanAbility.abbreviation = label.slice(0, 3).toLowerCase();
    }

    return cleanAbility;
  }

  static debug(string) {
    $('#cs-debug_box').append('<span>' + string + '<span>');
  }

  static async updateSettings(newSettings) {
    const oldSettings = CustomSkills.settings;
    let merged_settings = foundry.utils.mergeObject(oldSettings, newSettings);
    await game.settings.set(MODULE_NAME, 'settings', merged_settings);
    return true;
  }

  static isActorCharacter(actor) {
    return getProperty(actor, "type") == "character";
  }

  /* get actors with hasPlayerOwner property **/
  static getPlayerActors(excludeVehicles) {
    if (typeof excludeVehicles !== 'undefined' && excludeVehicles == true) {
      return game.actors.filter(a => (a.type === 'character' || a.type === 'npc') === true);
    } else {
      return game.actors.filter(a => (a.collectionName === 'actors') === true);
    }
  }

  /** helper functions to get specific settings */
  static getCustomSkillList() {
    let csSettings = CustomSkills.settings;
    return csSettings.customSkillList;
  }
  static getCustomAbilitiesList() {
    let csSettings = CustomSkills.settings;
    return csSettings.customAbilitiesList;
  }
  static getHiddenAbilities() {
    let csSettings = CustomSkills.settings;
    return csSettings.hiddenAbilities;
  }
  static getHiddenSkills() {
    let csSettings = CustomSkills.settings;
    return csSettings.hiddenSkills;
  }
  static getCurrentSkillNum() {
    let csSettings = CustomSkills.settings;
    return csSettings.skillNum;
  }
  static getCurrentAbilitiesNum() {
    let csSettings = CustomSkills.settings;
    return csSettings.abilitiesNum;
  }
  static getOpenCharacterSheets() {
    // return Object.values(ui.windows).filter(w => (w.options.baseApplication == 'ActorSheet' && w.rendered == true));
    return Object.values(ui.windows).filter(w => (w instanceof dnd5e.applications.actor.ActorSheet5eCharacter));
  }
  // refresh open actor sheets to view results
  static refreshOpenSheets() {
    const sheets = this.getOpenCharacterSheets();
    sheets.forEach((sheet, index) => {
      sheet.render();
    });
  }
  //create abbreviation key for i18n (tidy5e sheet pull from there when showing abilities)
  static getI18nKey(string) {
    let key = string.charAt(0).toUpperCase() + string.slice(1);
    return 'Ability' + key + 'Abbr';
  }

  static countObject(obj) {
    return Object.keys(obj).length
  }

  /* utility function to remove a key from object
   * params:
   *  obj = the object to process
   *  property = the propery to remove
   */
  static removeKey(obj, property) {
    const {
      [property]: unused,
      ...rest
    } = obj;
    return rest;
  }

  /**
   * get: param (string optional); ['skills','abilities','hiddenSkills','hiddenAbilities']
   * add: param (object required);
   * update: param (object required);
   **/

  static _integration(action, params, apply = false) {
    let data = [];
    if (typeof action !== 'undefined') {
      switch (action) {
        case 'get':
          data = this._integrationGet(params);
          return data;
        case 'add':
          data = this._integrationAdd(params, apply);
          return data;
        case 'update':
          data = this._integrationChange(params, apply);
          return data;
        default:
          return {
            'error': 'Action parameter unknown. Allowed values are: "get", "add" or "update"'
          };
      }
    } else {
      return {
        'error': 'Missing required "action" parameter (string)'
      }
    }
  };

  static async _integrationUpdate(settings, apply) {
    await this.updateSettings(settings);
    if (apply) {
      this.applyToSystem();
      await this.resetActors();
    }
  }

  static async resetActors() {
    const actors = this.getPlayerActors();
    const keys = Object.keys(actors);
    keys.forEach((key, index) => {
      let Actor = actors[key];
      Actor.reset();
    });

    this.refreshOpenSheets();

    return true;
  }
  /*
    API get
  */
  static _integrationGet(target) {
    if (typeof target == 'undefined')
      return CustomSkills.settings;
    switch (target) {
      case 'skills':
        return this.getCustomSkillList();
        break;
      case 'abilities':
        return this.getCustomAbilitiesList();
        break;
      case 'hiddenSkills':
        return this.getHiddenSkills();
        break;
      case 'hiddenAbilities':
        return this.getHiddenAbilities();
      default:
        return {
          'error': 'Action parameter unknown'
        };
    }

  }
  /*
    API add
  */
  static async _integrationAdd(dataObject, apply = false) {
    let response = {};
    let settings = CustomSkills.settings;

    if ('skills' in dataObject) {
      let resultSkills = this.addSkill(dataObject.skills, settings.customSkillList);
      if (!'errors' in resultSkills) {
        settings.customSkillList = resultSkills.skills;
      } else {
        response.skillerrors = resultSkills.errors;
      }
      // update skill number
      settings.skillNum = this.countObject(settings.customSkillList);

      response.skills = {
        'list': settings.customSkillList,
        'number': settings.skillNum
      };
    }
    if ('abilities' in dataObject) {
      let resultAbilities = this.addAbility(dataObject.abilities, settings.customAbilitiesList);
      if (!'errors' in resultAbilities) {
        settings.customAbilitiesList = resultAbilities.abilities;
      } else {
        response.abilityerrors = resultAbilities.errors;
      }
      // update abilities number
      settings.abilitiesNum = this.countObject(settings.customAbilitiesList);

      response.abilities = {
        'list': settings.customAbilitiesList,
        'number': settings.abilitiesNum
      };
    }

    this._integrationUpdate(settings, apply);

    return response;
  }

  static addSkill(newSkills, currentSkills) {
    if (typeof newSkills == 'undefined' || newSkills == 'help') {
      return {
        'error': 'To add skills you need to set an object parameter containing the new skills'
      };
    }

    let results = {};
    // check required options and duplicates
    let errors = [];
    let errorskeys = [];
    let uniqueSkills = newSkills;
    for (let ns in newSkills) {
      if (typeof newSkills[ns].ability == 'undefined')
        results.errors.push('Missing required "ability" key , (value type:string)');
      if (typeof newSkills[ns].label == 'label')
        results.errors.push('Missing required "label" key , (value type:string)');
      let duplicatedSkills = Object.values(currentSkills).filter((sk, i) => currentSkills['cus_' + i].label == newSkills[ns].label && currentSkills['cus_' + i].applied == true);
      if (duplicatedSkills.length) {
        uniqueSkills = this.removeKey(uniqueSkills, ns);
        errorskeys.push(ns)
      }
    }

    for (let e = 0; e < errorskeys.length; e++) {
      errors.push('Skill label already exists: ' + newSkills[errorskeys[e]].label);
    }

    results.errors = errors;

    let countActive = 0;
    const countNewSkills = this.countObject(uniqueSkills);
    const countOldSkills = this.countObject(currentSkills);
    const newSkillsKeys = Object.keys(uniqueSkills);
    let countAdded = 0;
    for (let s in currentSkills) {
      if (currentSkills[s].applied) {
        countActive++;
      } else {
        if (typeof newSkillsKeys[countAdded] === 'undefined')
          break;
        let skillData = uniqueSkills[newSkillsKeys[countAdded]];
        var newSkillClean = {
          'label': skillData.label,
          'ability': skillData.ability,
          'applied': 1
        };
        currentSkills[s] = foundry.utils.mergeObject(this.getBaseSkill(), newSkillClean);
        countAdded++;
      }
    }
    // add more skills if needed
    if (countAdded < countNewSkills) {
      var newmax = countNewSkills - countAdded;
      for (let n = 0; n <= newmax; n++) {
        if (typeof newSkillsKeys[countAdded] === 'undefined')
          break;
        let skillData = uniqueSkills[newSkillsKeys[countAdded]];
        var newSkillClean = {
          'label': skillData.label,
          'ability': skillData.ability,
          'applied': 1
        };
        currentSkills['cus_' + (n + countOldSkills)] = foundry.utils.mergeObject(this.getBaseSkill(), newSkillClean);
        countAdded++;
      }
    }
    results.skills = currentSkills;
    return results;
  }

  static addAbility(newAbility, currentAbilities) {
    if (typeof newAbility == 'undefined' || newAbility == 'help') {
      return {
        'error': 'To add Abilities you need to set an object parameter containing the new Abilities'
      };
    }

    let results = {};
    // check required options
    let errors = [];
    let errorskeys = [];
    let uniqueAbilities = newAbility;
    for (let na in newAbility) {
      if (typeof newAbility[na].label == 'label')
        errors.push('Missing required "label" key, (value type:string)');

      let duplicatedAbilities = Object.values(currentAbilities).filter((ab, i) => currentAbilities['cua_' + i].label == newAbility[na].label && currentAbilities['cua_' + i].applied == true);

      if (duplicatedAbilities.length) {
        uniqueAbilities = this.removeKey(uniqueAbilities, na);
        errorskeys.push(na);
      }
    }

    for (let e = 0; e < errorskeys.length; e++) {
      errors.push('Ability label already exists: ' + newAbility[errorskeys[e]].label);
    }

    let countActive = 0;
    const countNewAbilities = this.countObject(uniqueAbilities);
    const countOldAbilities = this.countObject(currentAbilities);
    const newAbKeys = Object.keys(uniqueAbilities);
    let countAdded = 0;
    for (let a in currentAbilities) {
      if (currentAbilities[a].applied) {
        countActive++;
      } else {
        if (typeof newAbKeys[countAdded] === 'undefined')
          break;
        let abilityData = uniqueAbilities[newAbKeys[countAdded]];
        var newAbilityClean = {
          'label': abilityData.label,
          'applied': 1
        };
        currentAbilities[a] = newAbilityClean;
        countAdded++;
      }
    }
    if (countAdded < countNewAbilities) {
      var newmax = countNewAbilities - countAdded;
      for (let n = 0; n <= newmax; n++) {
        if (typeof newAbKeys[countAdded] === 'undefined')
          break;
        let abilityData = uniqueAbilities[newAbKeys[countAdded]];
        var newAbilityClean = {
          'label': abilityData.label,
          'applied': 1
        };
        currentAbilities['cua_' + (n + countOldAbilities)] = newAbilityClean;
        countAdded++;
      }
    }
    results.abilities = currentAbilities;
    return results;
  }

  /*
   * Modify existing skills or abilities
   * to remove/disable a skill: {skills: {[skillkey]: {applied:false}}}
   * to remove/disable an ability: {abilities: {[abilitykey]: {applied:false}}}
   * skill or ability key must exist
   * params: object
   */
  static async _integrationChange(dataObject, apply) {

    let settings = CustomSkills.settings;
    let skills = settings.customSkillList;
    let abilities = settings.customAbilitiesList;

    let modSk = false;
    let modAb = false;

    for (let d in dataObject) {
      if (d == 'skills') {
        for (let sk in dataObject[d]) {
          if (typeof skills[sk] !== 'undefined') {
            skills[sk] = foundry.utils.mergeObject(skills[sk], dataObject[d][sk]);
            if (!modSk)
              modSk = true;
          }
        }
      } else if (d == 'abilities') {
        for (let ab in dataObject[d]) {
          if (typeof abilities[ab] !== 'undefined') {
            abilities[ab] = foundry.utils.mergeObject(abilities[ab], dataObject[d][ab]);
            if (!modAb)
              modAb = true;
          }
        }
      }
    }

    var response = {};

    if (modSk) {
      settings.customSkillList = skills;
      response.skills = settings.customSkillList;
    }
    if (modAb) {
      settings.customAbilitiesList = abilities;
      response.abilities = settings.customAbilitiesList;
    }

    this._integrationUpdate(settings, apply);

    if (modSk || modAb)
      return response;
    else
      return {
        'error': 'invalid input parameters, nothing to do',
        'data_sent': dataObject
      };
  }

  /*
  Temporary modify the dnd5e skill config.
  Optional parameter: "remove code" to remove a single skill from dnd5e config.
  All changes are in memory and temporary, and should be reapplied when needed.
  No modification is made to dnd5e system.
   */
  static applyToSystem() {
    //console.log('dnd-5e-custom-skills.applyToSystem');
    let systemSkills = game.dnd5e.config.skills;
    let systemAbilities = game.dnd5e.config.abilities;

    // see if we need to modify the _fallback translation for compatibility with tidy5esheet
    let isFallback = false;
    if (typeof game.i18n.translations.DND5E === 'undefined' && typeof game.i18n._fallback != 'undefined') {
      isFallback = true;
    }
    let abbrKey = '';

    const skillKeys = Object.keys(systemSkills).filter(k => k.startsWith('cus_') || k.startsWith('cua_'));
    const abilityKeys = Object.keys(systemAbilities).filter(k => k.startsWith('cua_') || k.startsWith('cus_'));

    let customSkills = this.getCustomSkillList();

    // remove extra skills keys
    for (let r = 0; r < skillKeys.length; r++) {
      if (typeof customSkills[skillKeys[r]] === 'undefined') {
        systemSkills = this.removeKey(systemSkills, skillKeys[r]);
      }
    }

    let customAbilities = this.getCustomAbilitiesList();
    // remove extra abilities keys
    for (let x = 0; x < abilityKeys.length; x++) {
      if (typeof customAbilities[abilityKeys[x]] === 'undefined') {
        abbrKey = this.getI18nKey(abilityKeys[x]);
        systemAbilities = this.removeKey(systemAbilities, abilityKeys[x]);
        //systemAbilityAbbr = this.removeKey(systemAbilityAbbr, abbrKey);
        if (typeof game.i18n.translations.DND5E[abbrKey] != 'undefined')
          game.i18n.translations.DND5E = this.removeKey(game.i18n.translations.DND5E, abbrKey);
        if (isFallback && typeof game.i18n._fallback.DND5E[abbrKey] != 'undefined')
          game.i18n._fallback.DND5E = this.removeKey(game.i18n._fallback.DND5E, abbrKey);
      }
    }

    // add skills
    for (let s in customSkills) {
      if (customSkills[s].applied) {
        systemSkills[s] = {
          'label': customSkills[s].label,
          'ability': customSkills[s].ability
        };
        if (window._isDaeActive) {
          this.daeAutoFields(s, true)
        }
      } else {
        // remove not applied skills
        if (typeof systemSkills[s] != "undefined") {
          systemSkills = this.removeKey(systemSkills, s);
        }
      }
    }

    // add abilities
    for (let a in customAbilities) {
      abbrKey = this.getI18nKey(a);
      if (customAbilities[a].applied) {
        systemAbilities[a] = this.getBaseAbility(customAbilities[a].applied, customAbilities[a].label);
        if (window._isDaeActive) {
          this.daeAutoFields(a);
        }
      } else {
        // remove translation
        if (isFallback) {
          if (typeof game?.i18n?._fallback?.DND5E != 'undefined' && typeof game?.i18n?._fallback?.DND5E[abbrKey] != 'undefined') {
            game.i18n._fallback.DND5E = this.removeKey(game.i18n._fallback.DND5E, abbrKey);
          }
        } else {
          //console.log('cust',game.i18n.translations);
          if (typeof game?.i18n.translations.DND5E[abbrKey] !== 'undefined')
            game.i18n.translations.DND5E = this.removeKey(game.i18n.translations.DND5E, abbrKey);
        }
      }
    }

    // update system config
    game.dnd5e.config.skills = this._sortObject(systemSkills, 'label');
    game.dnd5e.config.abilities = systemAbilities;
    // game.dnd5e.config.abilityAbbreviations = systemAbilityAbbr;
  }

  /* helper function to sort objects converting to array first**/
  static _sortObject(object, attribute) {
    let sort, obj_array = [];
    let result = {};

    if (typeof attribute == 'undefined')
      return object;

    obj_array = Object.entries(object).map(([key, obj]) => ({ key, ...obj }));
    sort = obj_array.sort((a, b) => a[attribute].localeCompare(b[attribute]));
    result = sort.reduce((obj, item) => Object.assign(obj, { [item.key]: item }, delete item.key), {});

    return result;
  }

  static async updateActors(skills, abilities) {
    // add skills and abilities to actors
    for (let s in skills) {
      if (skills[s].applied)
        CustomSkills.addSkillToActors(s);
    }

    for (let a in abilities) {
      if (abilities[a].applied == true)
        CustomSkills.addAbilityToActor(a);
    }

    // clean leftovers on players actors
    await CustomSkills.cleanActors();
    ui.notifications.info(game.i18n.localize(MODULE_NAME + '.updateDone'));
    return true;
  }

  // remove every leftover from this module from actors charcaters
  static async cleanActors() {
    const characters = this.getPlayerActors();
    const skillList = this.getCustomSkillList();
    const abilityList = this.getCustomAbilitiesList();

    const keys = Object.keys(characters);

    const total = keys.length;

    if (total > 0) {
      keys.forEach((key, index) => {
        let Actor = characters[key];
        let updatedDataSkills = {},
          updatedDataAbilities = {},
          skillKeys = {},
          abilityKeys = {};

        let actorSkills = Actor.system.skills;
        let actorAbilities = Actor.system.abilities;

        // we need to find what actual actor skills and abilities comes from this module.
        if (typeof actorSkills !== 'undefined') // could be undefined in case of vehicles
          skillKeys = Object.keys(actorSkills).filter(k => k.startsWith('cus_') || k.startsWith('cua_'));

        if (typeof actorAbilities !== 'undefined')
          abilityKeys = Object.keys(actorAbilities).filter(k => k.startsWith('cua_') || k.startsWith('cus_'));

        // here we store a list of keys representig properties we don't need anymore on actors.
        let skillsToRemove = [];
        let abilitiesToRemove = [];

        // prepare data to remove leftover skills
        for (let s = 0; s < skillKeys.length; s++) {
          let skillkey = skillKeys[s];
          if (typeof skillList[skillkey] == 'undefined' || skillList[skillkey].applied == false) {
            skillsToRemove.push(skillkey);
          }
        }

        //  prepare data to remove leftover abilities
        for (let a = 0; a < abilityKeys.length; a++) {
          let abilityKey = abilityKeys[a];
          if (typeof abilityList[abilityKey] == 'undefined' || abilityList[abilityKey].applied == false) {
            abilitiesToRemove.push(abilityKey);
          }
        }

        //we use foundry "-=" syntax to erase old properties
        skillsToRemove.forEach(key => updatedDataSkills[`system.skills.-=${key}`] = null);
        abilitiesToRemove.forEach(key => updatedDataAbilities[`system.abilities.-=${key}`] = null);

        // prepare the update actor data
        let updatedData = {
          ...updatedDataSkills,
          ...updatedDataAbilities
        };
        // finally update this actor
        Actor.update(updatedData);
      })
    }
    return true;
  }

  /** add single skill to every actor **/
  static addSkillToActors(skillCode) {
    let skillList = this.getCustomSkillList();
    let skillToAdd = skillList[skillCode];
    let characters = this.getPlayerActors(true);
    let charactersToAddSkill = characters.filter(s => s.system.skills.hasOwnProperty(skillCode) == false);
    const keys = Object.keys(charactersToAddSkill);

    const total = keys.length;

    if (total > 0) {
      keys.forEach((key, index) => {
        let Actor = charactersToAddSkill[key];
        Actor.update({ [`system.skills.${skillCode}`]: skillToAdd });
        Actor.reset();
      })
    }
  }

  /** add single ability to every actor **/
  static addAbilityToActor(abilityCode) {
    let emptyAbility;
    if (dndV3) {
      emptyAbility = game.system.config.abilities.cha;
    } else {
      emptyAbility = game.system.config.skills.acr;
    }
    let newAbility = foundry.utils.deepClone(emptyAbility);
    const customAbilities = CustomSkills.getCustomAbilitiesList();

    if (customAbilities.hasOwnProperty(abilityCode)) {
      newAbility.abbr = customAbilities[abilityCode].label.slice(0, 3).toLowerCase();
    }

    let characters = this.getPlayerActors();
    let charactersToAddAbility = characters.filter(s => s.system.abilities.hasOwnProperty(abilityCode) == false);
    const keys = Object.keys(charactersToAddAbility);

    const total = keys.length;

    if (total > 0) {
      keys.forEach((key, index) => {
        let Actor = charactersToAddAbility[key];
        Actor.reset();
      })
    }
  }

  // dae autocomplete compatibility
  static daeAutoFields(code, isSkill) {
    if (typeof isSkill != 'undefined' && isSkill == true) {
      DAE.addAutoFields([
        "system.skills." + code + ".value",
        "system.skills." + code + ".ability",
        "system.skills." + code + ".bonuses.check",
        "system.skills." + code + ".bonuses.passive"
      ]);
    } else {
      DAE.addAutoFields([
        "system.abilities." + code + ".value",
        "system.abilities." + code + ".proficient",
        "system.abilities." + code + ".bonuses.check",
        "system.abilities." + code + ".bonuses.save",
        "system.abilities." + code + ".min"
      ]);
    }
  }

}

function addLabels(app, html, data) {
  // get container app from app.id and not from html since it changes in dndv3 when editing.
  var current_sheet = $('#' + app.id);

  //dndbeyond character sheet is unfixable, don't touch it.
  if (!current_sheet.hasClass('dndbcs')) {
    // new classes for ui and css purposes
    current_sheet.addClass("cs");
    current_sheet.find(".skills-list").addClass("custom-skills");
    current_sheet.find(".ability-scores").addClass("custom-abilities");
  }
  let sheetVersion = '';
  if (current_sheet.hasClass('dnd5e2')) {
    sheetVersion = 'dnd2';
  } else if (current_sheet.hasClass('dnd5e')) {
    sheetVersion = 'legacy';
  } else if (current_sheet.hasClass('tidy5e-sheet')) {
    sheetVersion = 'tidy';
  }

  const skillList = CustomSkills.getCustomSkillList();
  const hiddenSkills = CustomSkills.getHiddenSkills();
  const hiddenAbilities = CustomSkills.getHiddenAbilities();
  let skillRowSelector = ".skills-list .skill";
  if (dndV3) {
    skillRowSelector = "filigree-box.skills li";
  }

  current_sheet.find(skillRowSelector).each(function () {
    const skillElem = $(this);
    let skillKey = $(this).attr("data-skill");
    if (sheetVersion == 'legacy') {
      skillKey = $(this).attr("data-key");
    }
    // if this skill is created by this module..
    if (skillList.hasOwnProperty(skillKey)) {
      //add labels to existing skill
      data.system.skills[skillKey].label = skillList[skillKey].label;
      skillElem.find(".skill-name").text(skillList[skillKey].label);
    }
  });

  /** hide skills **/
  for (let hs in hiddenSkills) {
    if (hiddenSkills[hs]) {
      if (sheetVersion == 'dnd2') {
        $('.skills li[data-key="' + hs + '"]', current_sheet).addClass('disabled');
      } else {
        $('.skills-list .skill[data-key="' + hs + '"]', current_sheet).addClass('disabled');
      }
    }
  }

  /** hide abilities **/
  for (let ha in hiddenAbilities) {
    if (hiddenAbilities[ha]) {
      if (sheetVersion == 'dnd2') {
        $('.ability-scores .ability-score[data-ability ="' + ha + '"]', current_sheet).addClass('disabled');
        $('.saves li[data-ability ="' + ha + '"]', current_sheet).addClass('disabled');
      } else if (sheetVersion == 'legacy') {
        $('.ability-scores .ability[data-ability ="' + ha + '"]', current_sheet).addClass('disabled');
      } else if (sheetVersion == 'tidy') {
        $('.actor-stats .wrapper[data-ability ="' + ha + '"]', current_sheet).parent().addClass('disabled');
      }

    }

  }

  return (app, html, data);
}

/** perform some necessary operations on character sheet **/
Hooks.on("renderActorSheet", addLabels);

/* first run needs to wait for i18n (or tidy5esheet won't show labels) */
Hooks.on("i18nInit", async () => {
  if (!window._isDaeActive) {
    CustomSkills.applyToSystem();
  }
});

Hooks.on("DAE.setupComplete", async () => {
  //console.log('dnd-5e-custom-skills.DAE.STARTED');
  CustomSkills.applyToSystem();
});
