const MODULE_NAME = 'dnd5e-custom-skills';

Handlebars.registerHelper("csFormat", (path, ...args) => {
    return game.i18n.format(path, args[0].hash);
});

Handlebars.registerHelper("inObject", (object, value) => {
  if (typeof object != 'undefined')
    return Object.values(object).includes(value)
  return false;
});

/**
 *  ▄▀▀░█▒█░▄▀▀░▀█▀░▄▀▄░█▄▒▄█░░░▄▀▀░█▄▀░█░█▒░░█▒░░▄▀▀░░▒▄▀▄▒█▀▄▒█▀▄░█▒░░█░▄▀▀▒▄▀▄░▀█▀░█░▄▀▄░█▄░█░░░▄▀▀▒██▀░▀█▀░▀█▀░█░█▄░█░▄▀▒░▄▀▀░░▒█▀░▄▀▄▒█▀▄░█▄▒▄█
░*  ▀▄▄░▀▄█▒▄██░▒█▒░▀▄▀░█▒▀▒█▒░▒▄██░█▒█░█▒█▄▄▒█▄▄▒▄██▒░░█▀█░█▀▒░█▀▒▒█▄▄░█░▀▄▄░█▀█░▒█▒░█░▀▄▀░█▒▀█▒░▒▄██░█▄▄░▒█▒░▒█▒░█░█▒▀█░▀▄█▒▄██▒░░█▀░▀▄▀░█▀▄░█▒▀▒█
 */
 
class CustomSkillsForm extends FormApplication {
    
  static get defaultOptions() {
      return mergeObject(super.defaultOptions, {
          title: game.i18n.localize(MODULE_NAME + '.form-title'),
          id: 'skills-form',
          template: `modules/${MODULE_NAME}/templates/skills-config.html`,
          width: 700,
          closeOnSubmit: false
      });
  }

  getData(options) {
      let data = mergeObject(
        { abilities: CONFIG.DND5E.abilities, skills: CONFIG.DND5E.skills },
        this.reset ? mergeObject(CustomSkills.defaultSettings, {requireSave:true}) : mergeObject(CustomSkills.settings, {requireSave:false}));
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
    let Form = mergeObject({},formData , { insertKeys: true, insertValues: true, overwrite: true });
    const oldSettings = CustomSkills.settings;
    
    let newSkills = {};
    let newAbilities = {};
    let newSettings = mergeObject(oldSettings, Form);
    
    // check if skills have been removed 
    if (Form.skillNum < CustomSkills.countObject(oldSettings.customSkillList)) {
      let count = 0;
      for (let a in Form.customSkillList) {
        if (count < Form.skillNum){
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
        if (count < Form.abilitiesNum){
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
    
    return this.render();
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="reset"]').click(this.onReset.bind(this));
  }
    
  async _onChangeInput(event){
    const elem = $(event.originalEvent.target);
    const container = super.element;
    
    // enable skill
    if (elem.hasClass('apply_skill')) {
      const skillCode = elem.data('skill');
      if (elem.prop('checked')) {
        $('select#select_'+skillCode, container).attr('disabled', 'disabled');
        $('input[name="fakeSkillList.' + skillCode + '.label"]', container).attr('readonly', 'readonly');
      } else {
        $('select#select_'+skillCode, container).removeAttr('disabled');
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
      $('input[name="customSkillList.'+skillCode+'.ability"]').val(selected);
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
      default: CustomSkills.defaultSettings,
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
    
    window.dnd5eCustomSkills = function(action, params) {
      return CustomSkills.integration(action, params);
    };
});

/* 
*░▄▀▀░█▒█░▄▀▀░▀█▀░▄▀▄░█▄▒▄█░░░▄▀▀░█▄▀░█░█▒░░█▒░░░░▄▀▀░█▒░▒▄▀▄░▄▀▀░▄▀▀
*░▀▄▄░▀▄█▒▄██░▒█▒░▀▄▀░█▒▀▒█▒░▒▄██░█▒█░█▒█▄▄▒█▄▄▒░░▀▄▄▒█▄▄░█▀█▒▄██▒▄██
*/

class CustomSkills {
  static get settings() {
    let csSettings = mergeObject(this.defaultSettings, game.settings.get(MODULE_NAME, 'settings'));
    // skills
    const oldSkillNum = Object.keys(csSettings.customSkillList).length;
    const oldAbilityNum = Object.keys(csSettings.customAbilitiesList).length;
    
    if (csSettings.skillNum > oldSkillNum) {
      // there are more skills than before
      let skills = {};
      for (let n = oldSkillNum; n < csSettings.skillNum; n++){
        let name = 'cus_' + n;
        skills[name] = this.getBaseSkill();
      }
      csSettings.customSkillList = mergeObject(csSettings.customSkillList, skills);
    } else if (csSettings.skillNum < oldSkillNum) {
      //there are less skills than before, need to delete some
      for (let n = (oldSkillNum - 1); n >= csSettings.skillNum; n--){
        let name = 'cus_' + n;
        delete csSettings.customSkillList[name];
      }
    }
    
    if (csSettings.abilitiesNum > oldAbilityNum) {
      // there are more abilities than before
      let abilities = {};
      for (let n = oldAbilityNum; n < csSettings.abilitiesNum; n++){
        let name = 'cua_' + n;
        abilities[name] = {label: "", applied: false};
      }
      csSettings.customAbilitiesList = mergeObject(csSettings.customAbilitiesList, abilities);
    } else if (csSettings.abilitiesNum < oldAbilityNum) {
      //there are less abilities than before, need to delete some
      for (let n = (oldAbilityNum - 1); n >= csSettings.abilitiesNum; n--){
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
      abilities[name] = {label: "", applied: false};
    };
    
    return {
      customSkillList: skills,
      skillNum : skillNum,
      customAbilitiesList: abilities,
      abilitiesNum : abilitiesNum,
      hiddenAbilities : {},
      hiddenSkills : {}
    };
  }
  
  static getBaseSkill() {
    return foundry.utils.deepClone(game.system.template.Actor.templates.creature.skills.acr);
  }

  static debug(string) {
    $('#cs-debug_box').append('<span>' + string + '<span>');
  }
  
  static updateSettings(newSettings) {
    const oldSettings = CustomSkills.settings;
    let merged_settings = mergeObject(oldSettings, newSettings);
    game.settings.set(MODULE_NAME, 'settings', merged_settings);
  }

  static isActorCharacter(actor) {
    return getProperty(actor, "type") == "character";
  }

  /* get actors with hasPlayerOwner property **/
  static getPlayerActors(excludeVehicles) {
    let filtered = {};
    if (typeof excludeVehicles !== 'undefined' && excludeVehicles == true) {
      //filtered = game.actors.filter(a => (a.hasPlayerOwner === true && a.type === 'character') === true);
      return game.actors.filter(a => (a.type === 'character' || a.type === 'npc') === true);
    } else {
      //filtered = game.actors.filter(a => a.hasPlayerOwner === true);
      return game.actors.filter(a => (a.collectionName === 'actors') === true);
    }
    return filtered;
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
  //create abbreviation key for i18n (tidy5e sheet pull from there when showing abilities)
  static getI18nKey(string) {
    let key = string.charAt(0).toUpperCase() + string.slice(1);
    return 'Ability' + key + 'Abbr';
  }
  
  static countObject(obj) {
    return Object.keys(obj).length
  }
  
  /**
  * get: param (string optional); ['skills','abilities','hiddenSkills','hiddenAbilities']
  * add: param (object required);
  * update: param (object required);
  **/
  
  static integration(action, params){
    if (typeof action !== 'undefined') {
      switch (action) {
        case 'get' : 
          return this._integrationGet(params);
        break;
        case 'add' : 
          return this._integrationAdd(params);
        break;
        case 'update' : 
          return this._integrationChange(params);
        break;
        default: 
          return {'error': 'Action parameter unknown'};
      }
    } else {
      return {'error': 'Missing "action" paramter(string)'}
    }
  };
  
  static _integrationGet(string) {
    if (typeof string == 'undefined')
      return CustomSkills.settings;
    switch (string) {
      case 'skills' : 
        return this.getCustomSkillList();
      break;
      case 'abilities' : 
        return this.getCustomAbilitiesList();
      break;
      case 'hiddenSkills' : 
        return this.getHiddenSkills();
      break;
      case 'hiddenAbilities' : 
        return this.getHiddenAbilities();
      default: 
        return {'error': 'Action parameter unknown'};
    }
    
  }
  /* params object
    'skills': {
      0: {
        'label': 'newSkill 1',
        'ability': 'str'
      },
      1: {
        'label': 'newSkill 2',
        'ability': 'dex'
      },
      2: {
        'label': 'newSkill 3',
        'ability': 'str'
      },
      3: {
        'label': 'newSkill 4',
        'ability': 'str'
      }
    },
    'abilities' = {
      0: {
        'label': 'new Ability 1'
      },
      1: {
        'label': 'new Ability 2'
      },
      2: {
        'label': 'new Ability 3'
      },
      3: {
        'label': 'new Ability 4'
      }
    };
  */
  
  static _integrationAdd(dataObject){
    let response = [];
    
    if ('skills' in dataObject) {
      response['skills'] = this.addSkill(dataObject.skills);
    }
    if ('abilities' in dataObject) {
      response['abilities'] = this.addSkill(dataObject.skills);
    }
    
    return response;
  }
  
  static addSkill(newSkills) {
    if (typeof newSkills == 'undefined' || newSkills == 'help') {
        return {'error': 'To add skills you need to set an object parameter containing the new skills'};
    }
    // check required options
    let errors = [];
    for (let ns in newSkills) {
      if (typeof newSkills[ns].ability == 'undefined')
        errors.push('Missing required "ability" key , (value type:string)');
      if (typeof newSkills[ns].label == 'label')
        errors.push('Missing required "label" key , (value type:string)');
    }
    if (errors.length)
      return errors;
    
    let settings = CustomSkills.settings;
    let countActive = 0;
    const countNewSkills = this.countObject(newSkills);
    const countOldSkills = this.countObject(settings.customSkillList);
    let countAdded = 0;
    for (let s in settings.customSkillList){
      if (settings.customSkillList[s].applied) {
        countActive++;
      } else {
        var newSkillClean = {
          'label':newSkills[countAdded].label,
          'ability':newSkills[countAdded].ability,
          'applied':1
        };
        settings.customSkillList[s] = mergeObject(this.getBaseSkill(),newSkillClean);
        countAdded++;
      }
    }
    if (countAdded < countNewSkills) {
      var newmax = countNewSkills + countAdded;
      for (let n = (countNewSkills - countAdded); n <= newmax; n++) {
        var newSkillClean = {
          'label':newSkills[countAdded].label,
          'ability':newSkills[countAdded].ability,
          'applied':1
        };
        settings.customSkillList['cus_'+n] = mergeObject(this.getBaseSkill(),newSkillClean);
        countAdded++;
      }
      // update skill number
      settings.skillNum = Object.keys(settings.customSkillList).length;
      this.updateSettings(settings);
    }
    return settings.customSkillList;
  }
  
  static addAbility(newAbility) {
    if (typeof newAbility == 'undefined' || newAbility == 'help') {
        return {'error': 'To add Abilities you need to set an object parameter containing the new Abilities'};
    }
    
    // check required options
    let errors = [];
    for (let ns in newAbility) {
      if (typeof newAbility[ns].label == 'label')
        errors.push('Missing required "label" key, (value type:string)');
    }
    if (errors.length)
      return errors;
    
    let settings = CustomSkills.settings;
    let countActive = 0;
    const countNewAbilities = Object.keys(newAbility).length;
    const countOldAbilities = Object.keys(settings.customAbilitiesList).length;
    
    let countAdded = 0;
    for (let a in settings.customAbilitiesList){
      if (settings.customAbilitiesList[a].applied) {
        countActive++;
      } else {
        var newAbilityClean = {
          'label':newAbility[countAdded].label,
          'applied':1
        };
        settings.customAbilitiesList[a] = newAbilityClean;
        countAdded++;
      }
    }
    if (countAdded < countNewAbilities) {
      var newmax = countNewAbilities + countAdded;
      for (let n = (countNewAbilities - countAdded); n <= newmax; n++) {
        console.log('N:',n,' newmax: ', newmax);
        var newAbilityClean = {
          'label':newAbility[countAdded].label,
          'applied':1
        };
        settings.customAbilitiesList['cus_'+n] = newAbilityClean;
        countAdded++;
      }
      // update abilities number
      settings.abilitiesNum = Object.keys(settings.customAbilitiesList).length;
      this.updateSettings(settings);
    }
    return settings.customAbilitiesList;
  }
  
  /*
  * Modify existing skills or abilities
  * to remove/disable a skill: {skills: {[skillkey]: {applied:false}}}
  * to remove/disable an ability: {abilities: {[abilitykey]: {applied:false}}}
  * skill or ability key must exist
  * params: object
  * 
  * {
      skills: {
        "cus_X": {
          "label": "Skill Name" (str)
          "ability": "dex" (str)
          "applied": true/false (bool)
        }
      },
      abilities: {
        "label": "Ability Name" (str)
        "applied": true/false (bool)
      }
    } 
  */
  static _integrationChange(dataObject){
    
    let settings = CustomSkills.settings;
    let skills = settings.customSkillList;
    let abilities = settings.customAbilitiesList;
    
    let modSk = false;
    let modAb = false;
    
    for (let d in dataObject) {
      if (d == 'skills') {
        for (let sk in dataObject[d]) {
          if (typeof skills[sk] !== 'undefined'){
            skills[sk] = mergeObject(skills[sk], dataObject[d][sk]);
            if (!modSk)
              modSk = true;
          }
        }
      } else if (d == 'abilities') {
        for (let ab in dataObject[d]) {
          if (typeof abilities[ab] !== 'undefined'){
            abilities[ab] = mergeObject(abilities[ab], dataObject[d][ab]);
            if (!modAb)
              modAb = true;
          }
        }
      }
    }
    
    var result = [];
    
    if (modSk)
      settings.customSkillList = result['skills'] = skills;
    if (modAb)
      settings.customAbilitiesList = result['abilities'] = abilities;
    
    this.updateSettings(settings);
    
    return result;
  }

  /* 
    Temporary modify the dnd5e skill config.
    Optional parameter: "remove code" to remove a single skill from dnd5e config.
    All changes are in memory and temporary, and should be reapplied when needed.
    No modification is made to dnd5e system.
  */
  static applyToSystem() {
    let systemSkills = game.dnd5e.config.skills;
    let systemAbilities = game.dnd5e.config.abilities;
    let systemAbilityAbbr = game.dnd5e.config.abilityAbbreviations;
    
    // see if we need to modify the _fallback translation for compatibility with tidy5esheet
    let isFallback = false;
    if (typeof game.i18n.translations.DND5E === 'undefined' && typeof game.i18n._fallback != 'undefined') {
      isFallback = true;
    }
    let abbrKey = '';
    
    const skillKeys = Object.keys(systemSkills).filter(k => k.startsWith('cus_'));
    const abilityKeys = Object.keys(systemAbilities).filter(k => k.startsWith('cua_'));
    
    let customSkills = this.getCustomSkillList();
    
    console.log('customSkills[apply to system]',customSkills);
    
    // remove extra skills keys
    for (let r = 0; r < skillKeys.length; r++) {
      if (typeof customSkills[skillKeys[r]] === 'undefined'){
        console.log('removing', skillKeys[r], systemSkills[skillKeys[r]])
        systemSkills = this.removeKey(systemSkills, skillKeys[r]);
      }
    }
    
    let customAbilities = this.getCustomAbilitiesList();
    // remove extra abilities keys
    for (let x = 0; x < abilityKeys.length; x++) {
      if (typeof customAbilities[abilityKeys[x]] === 'undefined'){
        abbrKey = this.getI18nKey(abilityKeys[x]);
        console.log('removing', abilityKeys[x], systemAbilities[abilityKeys[x]])
        systemAbilities = this.removeKey(systemAbilities, abilityKeys[x]);
        systemAbilityAbbr = this.removeKey(systemAbilityAbbr, abbrKey);
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
          'label' : customSkills[s].label,
          'ability' : customSkills[s].ability
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
        let label = customAbilities[a].label;
        systemAbilities[a] = label;
        systemAbilityAbbr[a] = label.slice(0, 3).toLowerCase();
        if (isFallback) {
          game.i18n._fallback.DND5E[abbrKey] = systemAbilityAbbr[a];
        } else {
          game.i18n.translations.DND5E[abbrKey] = systemAbilityAbbr[a];
        }
        if (window._isDaeActive) {
          this.daeAutoFields(a); 
        }
      } else {
        // not applied, we should remove it.
        if (typeof systemAbilities[a] != "undefined") {
          systemAbilities = this.removeKey(systemAbilities, a);
        }
        if (typeof systemAbilityAbbr[a] != "undefined") {
          systemAbilityAbbr = this.removeKey(systemAbilityAbbr, a);
        }
        
        // remove translation
        if (isFallback) {
          if (typeof game.i18n._fallback.DND5E[abbrKey] != 'undefined')
            game.i18n._fallback.DND5E = this.removeKey(game.i18n._fallback.DND5E, abbrKey);
        } else {
          //console.log('cust',game.i18n.translations);
          if (typeof game.i18n.translations.DND5E[abbrKey] !== 'undefined')
            game.i18n.translations.DND5E = this.removeKey(game.i18n.translations.DND5E, abbrKey);
        }
      }
    }
    
    
    // update system config
    game.dnd5e.config.skills = systemSkills;
    game.dnd5e.config.abilities = systemAbilities;
    game.dnd5e.config.abilityAbbreviations = systemAbilityAbbr;
  }
  
  static async updateActors(skills, abilities) {
    // add skills and abilities to actors
    for (let s in skills) {
      if(skills[s].applied)
        CustomSkills.addSkillToActors(s);
    }
    
    for (let a in abilities) {
      if(abilities[a].applied == true)
        CustomSkills.addAbilityToActor(a);
    }
    
    // clean leftovers on players actors
    await CustomSkills.cleanActors();
    ui.notifications.info(game.i18n.localize(MODULE_NAME + '.updateDone'));
    
    return true;
  }
  
  // remove every leftover from this module from actors charcaters
  static async cleanActors(){
    const characters = this.getPlayerActors();
    const skillList = this.getCustomSkillList();
    const abilityList = this.getCustomAbilitiesList();
    
    const keys = Object.keys(characters);
    
    const total = keys.length;
    
    if (total > 0) {
      keys.forEach((key, index) => {
        let Actor = characters[key];
        let updatedDataSkills = {}, updatedDataAbilities = {}, skillKeys = {}, abilityKeys = {};
        //console.log('cleaning ACTOR:', Actor);
        let actorSkills = Actor.system.skills;
        let actorAbilities = Actor.system.abilities;
        // we need to find what actual actor skills and abilities comes from this module.
        if (typeof actorSkills !== 'undefined') // could be undefined in case of vehicles
          skillKeys = Object.keys(actorSkills).filter(k => k.startsWith('cus_'));
        if (typeof actorAbilities !== 'undefined')
          abilityKeys = Object.keys(actorAbilities).filter(k => k.startsWith('cua_'));
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
  
  /* utility function to remove a key from object 
   * params:
   *  obj = the object to process
   *  property = the propery to remove
  */
  static removeKey(obj, property) {
      const {
          [property]: unused, ...rest
      } = obj

      return rest
  }

  /** add single skill to actor **/
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
        Actor.reset();
      })
    }
  }
  
  /** add single ability to actor **/
  static addAbilityToActor(abilityCode){
    const emptyAbility = game.system.template.Actor.templates.common.abilities.cha;
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
  // new classes for ui and css purposes
  html.find(".skills-list").addClass("custom-skills");
  html.find(".ability-scores").addClass("custom-abilities");
  
  const skillList = CustomSkills.getCustomSkillList();
  const hiddenSkills = CustomSkills.getHiddenSkills();
  const hiddenAbilities = CustomSkills.getHiddenAbilities();
  const skillRowSelector = ".skills-list .skill";
  
  html.find(skillRowSelector).each(function() {
    const skillElem = $(this);
    const skillKey = $(this).attr("data-skill");
    // if this skill is created by this module..
    if (skillList.hasOwnProperty(skillKey)) {
      //add labels to existing skill
      data.system.skills[skillKey].label = skillList[skillKey].label;
      skillElem.find(".skill-name").text(skillList[skillKey].label);
    }
  });
  
  /** hide skills **/
  for (let hs in hiddenSkills) {
    if (hiddenSkills[hs])
      $('.skills-list .skill[data-skill="'+hs+'"]', html).addClass('disabled');
  }
  
  /** hide abilities **/
  for (let ha in hiddenAbilities) {
    if (hiddenAbilities[ha])
      $('.ability-scores .ability[data-ability ="'+ha+'"]', html).addClass('disabled');
  }

  return (app, html, data);
}

/** perform some necessary operations on character sheet **/
Hooks.on("renderActorSheet", addLabels);

/* first run needs to wait for i18n (or tidy5esheet won't show labels) */
Hooks.on("i18nInit", async () => {
  if (!window._isDaeActive) {
    console.log('dnd-5e-custom-skills.applyToSystem');
    CustomSkills.applyToSystem();
  }
});

Hooks.on("DAE.setupComplete", async () => {
  console.log('dnd-5e-custom-skills.DAE.STARTED');
  CustomSkills.applyToSystem();
});