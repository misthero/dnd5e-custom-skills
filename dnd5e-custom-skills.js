const MODULE_NAME = 'dnd5e-custom-skills';

var __awaiter = (this && this.__awaiter) || function(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function(resolve) { resolve(value); }); }
  return new(P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};

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
      //console.log('getData', data);
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
    
    let newSkills;
    let newAbilities;
    let newSettings = mergeObject(oldSettings, Form);
    // update settings
    await game.settings.set(MODULE_NAME, 'settings', newSettings);
    
    // check if skills have been added or removed 
    if (Form.skillNum < oldSettings.skillNum) {
      newSkills = mergeObject(Form.customSkillList, oldSettings.customSkillList, { insertKeys: false, insertValues: false, overwrite:false  });
      for (let removekey in oldSettings.customSkillList) {
        if (typeof newSkills[removekey] == 'undefined') {
          applyToSystem(removekey);
        }
      }
    } else {
      newSkills = mergeObject(oldSettings.customSkillList, Form.customSkillList, { insertKeys: true, insertValues: true, overwrite:true });
    };
    
    // check if abilities have been added or removed 
    if (Form.abilitiesNum < oldSettings.abilitiesNum) {
      newAbilities = mergeObject(Form.customAbilitiesList, oldSettings.customAbilitiesList, { insertKeys: false, insertValues: false, overwrite:false  });
      for (let removekey in oldSettings.customAbilitiesList) {
        if (typeof newAbilities[removekey] == 'undefined') {
          applyToSystem(removekey);
        }
      }
    } else {
      newAbilities = mergeObject(oldSettings.customAbilitiesList, Form.customAbilitiesList, { insertKeys: true, insertValues: true, overwrite:true });
    };
    
    await this.update(newSkills, newAbilities);
    
    return this.render();
  }
  
  async update(newSkills, newAbilities) {
    const keys_sk = Object.keys(newSkills);
    const keys_ab = Object.keys(newAbilities);
  
    const total = keys_sk.length + keys_ab.length;

    let message = game.i18n.localize(MODULE_NAME + '.processingSkills');;
    let percent = 0;
    let count = 0;
    
    // finally add skills and abilities to actors
    for (let s in newSkills) {
      if(newSkills[s].applied)
        CustomSkills.addSkillToActors(s);
      count++;
      percent = Math.round((count / total) * 100);
      SceneNavigation.displayProgressBar({label: message, pct: percent });
    }
    
    message = game.i18n.localize(MODULE_NAME + '.processingAbilities');
    for (let a in newAbilities) {
      if(newAbilities[a].applied == true)
        CustomSkills.addAbilityToActor(a);
      count++;
      percent = Math.round((count / total) * 100);
      SceneNavigation.displayProgressBar({label: message, pct: percent });
    }
    
    // modify system variables
    await CustomSkills.applyToSystem();
    // clean leftovers on players actors
    await CustomSkills.cleanActors();
    ui.notifications.info(game.i18n.localize(MODULE_NAME + '.updateDone'));
    
    return true;
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
        $('input[name="customSkillList.' + skillCode + '.label"]', container).attr('readonly', 'readonly');
      } else {
        $('select#select_'+skillCode, container).removeAttr('disabled');
        $('input[name="customSkillList.' + skillCode + '.label"]', container).removeAttr('readonly');
      }
    }
    
    // enable ability
    if (elem.hasClass('apply_ability')) {
      const abilityCode = elem.data('ability');
      if (elem.prop('checked')) {
        $('input[name="customAbilitiesList.' + abilityCode + '.label"]', container).attr('readonly', 'readonly');
      } else {
        $('input[name="customAbilitiesList.' + abilityCode + '.label"]', container).removeAttr('readonly');
      }
    }
    
    // select ability
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
    return {
      value: 0,
      ability: "str",
      bonuses: {
        check: '',
        passive: '',
      },
      mod: 0,
      passive: 0,
      total: 0,
      label: "",
      applied: 0
    };
  }

  static debug(string) {
    $('#cs-debug_box').append('<span>' + string + '<span>');
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
  //create abbreviation key for i18n (tidy5e sheet pull from there when showing abilities)
  static getI18nKey(string) {
    let key = string.charAt(0).toUpperCase() + string.slice(1);
    return 'Ability' + key + 'Abbr';
  }

  /* 
    Temporary modify the dnd5e skill config.
    Optional parameter: "remove code" to remove a single skill from dnd5e config.
    All changes are in memory and temporary, and should be reapplied when needed.
    No modification is made to dnd5e system.
  */
  static applyToSystem(removeCode) {
    let systemSkills = game.dnd5e.config.skills;
    let systemAbilities = game.dnd5e.config.abilities;
    let systemAbilityAbbr = game.dnd5e.config.abilityAbbreviations;

    // see if we need to modify the _fallback translation for compatibility with tidy5esheet
    let isFallback = false;
    if (typeof game.i18n.translations.DND5E === 'undefined') {
      isFallback = true;
    }
    let abbrKey = '';
    
    if (typeof removeCode != 'undefined') {
      abbrKey = this.getI18nKey(removeCode);
      // removing leftover
      if (typeof systemSkills[removeCode] != 'undefined')
        systemSkills = CustomSkills.removeKey(systemSkills, removeCode);
      if (typeof systemAbilities[removeCode] != 'undefined')
        systemAbilities = CustomSkills.removeKey(systemAbilities, removeCode);
      if (typeof systemAbilityAbbr[removeCode] != 'undefined')
        systemAbilityAbbr = CustomSkills.removeKey(systemAbilityAbbr, removeCode);
      if (isFallback) {
        if (typeof game.i18n._fallback.DND5E[abbrKey] != 'undefined')
          game.i18n._fallback.DND5E = CustomSkills.removeKey(game.i18n._fallback.DND5E, abbrKey);
      } else {
        if (typeof game.i18n.translations.DND5E[abbrKey] != 'undefined')
          game.i18n.translations.DND5E = CustomSkills.removeKey(game.i18n.translations.DND5E, abbrKey);
      }
    } else {
      // add or remove the rest 
      let customSkills = CustomSkills.getCustomSkillList();
      //console.log('customSkills',customSkills);
      for (let s in customSkills) {
        if (customSkills[s].applied) {
          let label = customSkills[s].label;
          systemSkills[s] = label;
          if (window._isDaeActive) {
            this.daeAutoFields(s, true)
          }
        } else if (typeof systemSkills[s] != "undefined") {
          systemSkills = CustomSkills.removeKey(systemSkills, s);
        }
      }
      
      let customAbilities = CustomSkills.getCustomAbilitiesList();
      //console.log('customAbilities',customAbilities);
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
          // not appled, we should remove it.
          if (typeof systemAbilities[a] != "undefined") {
            systemAbilities = CustomSkills.removeKey(systemAbilities, a);
          }
          if (typeof systemAbilityAbbr[a] != "undefined") {
            systemAbilityAbbr = CustomSkills.removeKey(systemAbilityAbbr, a);
          }

          if (isFallback) {
            if (typeof game.i18n._fallback.DND5E[abbrKey] != 'undefined')
              game.i18n._fallback.DND5E = CustomSkills.removeKey(game.i18n._fallback.DND5E, abbrKey);
          } else {
            //console.log('cust',game.i18n.translations);
            if (typeof game.i18n.translations.DND5E[abbrKey] !== 'undefined')
              game.i18n.translations.DND5E = CustomSkills.removeKey(game.i18n.translations.DND5E, abbrKey);
          }
          
        }
      }
    }
    
    // update system config
    game.dnd5e.config.skills = systemSkills;
    game.dnd5e.config.abilities = systemAbilities;
    game.dnd5e.config.abilityAbbreviations = systemAbilityAbbr;
  }
  
  // remove every leftover from this module from actors charcaters
  static cleanActors(){
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
        let updatedData = {
            [`system.skills.${skillCode}`]: skillToAdd
        };
        Actor.update(updatedData);
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
    //console.log('CHARACTErS:',characters);
    let charactersToAddAbility = characters.filter(s => s.system.abilities.hasOwnProperty(abilityCode) == false);
    const keys = Object.keys(charactersToAddAbility);
    
    const total = keys.length;
    
    if (total > 0) {
      keys.forEach((key, index) => {
        let Actor = charactersToAddAbility[key];
        let updatedData = {
            [`system.abilities.${abilityCode}`]: newAbility
        };
        Actor.update(updatedData);
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
  //console.log(data);
  // new classes for ui and css purposes
  html.find(".skills-list").addClass("custom-skills");
  html.find(".ability-scores").addClass("custom-abilities");
  
  const skillList = CustomSkills.getCustomSkillList();
  const hiddenSkills = CustomSkills.getHiddenSkills();
  const hiddenAbilities = CustomSkills.getHiddenAbilities();
  const skillRowSelector = ".skills-list .skill";
  
  //console.log(skillList);
  
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