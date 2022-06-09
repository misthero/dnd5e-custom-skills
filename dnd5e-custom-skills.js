const MODULE_NAME = 'dnd5e-custom-skills';
CONFIG.debug.hooks = true
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
      let data = mergeObject({ abilities: CONFIG.DND5E.abilities, skills: CONFIG.DND5E.skills }, this.reset ? CustomSkills.defaultSettings : CustomSkills.settings);
      return data;
  }

  onReset() {
      this.reset = true;
      game.settings.set(MODULE_NAME, 'settings', {});
      CustomSkills.cleanActors();
      this.render();
  }

  _updateObject(event, formData) {
    return __awaiter(this, void 0, void 0, function* () {
      let Form = mergeObject({},formData , { insertKeys: true, insertValues: true, overwrite: true });
      const oldSettings = CustomSkills.settings;
      
      let newSkills;
      let newAbilities;
      let newSettings = mergeObject(oldSettings, Form);
      
      /** check if skills have been added or removed **/
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
      
      /** check if abilities have been added or removed **/
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
      
      newSettings.customSkillList = newSkills;
      newSettings.customAbilitiesList = newAbilities;
      
      // update settings
      yield game.settings.set(MODULE_NAME, 'settings', newSettings);
      
      // finally add skills and abilities to actors
      for (let s in newSkills) {
        if(newSkills[s].applied)
          CustomSkills.addSkillToActors(s)
      }
      
      for (let a in newAbilities) {
        if(newAbilities[a].applied == true)
          CustomSkills.addAbilityToActor(a);
      }
      
      // modify system variables
      CustomSkills.applyToSystem();
      // clean leftovers on players actors
      CustomSkills.cleanActors();
      this.render();
    })
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
    console.log('dnd5e-custom-skills init');
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
      default: CustomSkillsForm.defaultSettings,
      type: Object,
      config: false,
      //onChange: (x) => window.location.reload()
    });
    
    
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
      let skills = {};
      for (let n = oldSkillNum; n < csSettings.skillNum; n++){
        let name = 'cus_' + n;
        skills[name] = this.getBaseSkill();
      }
      csSettings.customSkillList = mergeObject(csSettings.customSkillList, skills);
    } else if (csSettings.skillNum < oldSkillNum) {
      for (let n = (oldSkillNum - 1); n >= csSettings.skillNum; n--){
        let name = 'cus_' + n;
        delete csSettings.customSkillList[name];
      }
    }
    
    if (csSettings.abilitiesNum > oldAbilityNum) {
      let abilities = {};
      for (let n = oldAbilityNum; n < csSettings.abilitiesNum; n++){
        let name = 'cua_' + n;
        abilities[name] = {label: "", applied: false};
      }
      csSettings.customAbilitiesList = mergeObject(csSettings.customAbilitiesList, abilities);
    } else if (csSettings.abilitiesNum < oldAbilityNum) {
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
      ability: "str",
      bonus: 0,
      mod: 0,
      passive: 0,
      prof: 0,
      total: 0,
      value: 0,
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
  static getPlayerActors() {
    return game.actors.filter(a => a.hasPlayerOwner === true);
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
    // need to modify the _fallback translation for compatibility with tidy5esheet
    let i18nAbbr = {};
    if (typeof game.i18n._fallback.DND5E != 'undefined')
      i18nAbbr = game.i18n._fallback.DND5E;
    else 
      i18nAbbr = game.i18n.translations.DND5E;
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
      if (typeof i18nAbbr[abbrKey] != 'undefined')
        i18nAbbr = CustomSkills.removeKey(i18nAbbr, abbrKey);
    } else {
      // add or remove the rest 
      let customSkills = CustomSkills.getCustomSkillList();
      for (let s in customSkills) {
        if (customSkills[s].applied) {
          let label = customSkills[s].label;
          systemSkills[s] = label;
        } else if (typeof systemSkills[s] != "undefined") {
          systemSkills = CustomSkills.removeKey(systemSkills, s);
        }
      }
      
      let customAbilities = CustomSkills.getCustomAbilitiesList();
      for (let a in customAbilities) {
        abbrKey = this.getI18nKey(a);
        if (customAbilities[a].applied) {
          let label = customAbilities[a].label;
          systemAbilities[a] = label;
          systemAbilityAbbr[a] = label.slice(0, 3).toLowerCase();
          i18nAbbr[abbrKey] = systemAbilityAbbr[a];
        } else {
          if (typeof systemAbilities[a] != "undefined") {
            systemAbilities = CustomSkills.removeKey(systemAbilities, a);
          }
          if (typeof systemAbilityAbbr[a] != "undefined") {
            systemAbilityAbbr = CustomSkills.removeKey(systemAbilityAbbr, a);
          }
          if (typeof i18nAbbr[abbrKey] != 'undefined')
            i18nAbbr = CustomSkills.removeKey(i18nAbbr, abbrKey);
        }
      }
    }
    
    // update system config
    game.dnd5e.config.skills = systemSkills;
    game.dnd5e.config.abilities = systemAbilities;
    game.dnd5e.config.abilityAbbreviations = systemAbilityAbbr;
    game.i18n._fallback.DND5E = i18nAbbr;
  }
  
  // remove every leftover from this module from actors charcaters
  static cleanActors(){
    const characters = this.getPlayerActors();
    const skillList = this.getCustomSkillList();
    const abilityList = this.getCustomAbilitiesList();
    
    const keys = Object.keys(characters);
    
    if (keys.length > 0) {
      keys.forEach((key, index) => {
        let Actor = characters[key];
        let updatedDataSkills = Actor.data.data.skills;
        let updatedDataAbilities = Actor.data.data.abilities;
        let skillKeys = Object.keys(updatedDataSkills).filter(k => k.startsWith('cus_'));
        let abilityKeys = Object.keys(updatedDataAbilities).filter(k => k.startsWith('cua_'));
        
        // remove leftover skills
        for (let s = 0; s < skillKeys.length; s++) {
          let skillkey = skillKeys[s];
          if (typeof skillList[skillkey] != 'undefined' && skillList[skillkey].applied) {
            continue;
          }
          updatedDataSkills = CustomSkills.removeKey(updatedDataSkills, skillkey);
        }
        
        // remove leftover abilities
        for (let a = 0; a < abilityKeys.length; a++) {
          let abilityKey = abilityKeys[a];
          if (typeof abilityList[abilityKey] != 'undefined' && abilityList[abilityKey].applied) {
            continue;
          }
          updatedDataAbilities = CustomSkills.removeKey(updatedDataAbilities, abilityKey);
        }
        // update actor
        let updatedData = {
          [`data.skills`]: updatedDataSkills,
          [`data.abilities`]: updatedDataAbilities,
        };
        
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
    let characters = this.getPlayerActors();
    let charactersToAddSkill = characters.filter(s => s.data.data.skills.hasOwnProperty(skillCode) == false);
    const keys = Object.keys(charactersToAddSkill);
    
    if (keys.length > 0) {
      keys.forEach((key, index) => {
        let Actor = charactersToAddSkill[key];
        let updatedData = {
            [`data.skills.${skillCode}`]: skillToAdd
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
    let charactersToAddAbility = characters.filter(s => s.data.data.abilities.hasOwnProperty(abilityCode) == false);
    const keys = Object.keys(charactersToAddAbility);
    
    if (keys.length > 0) {
      keys.forEach((key, index) => {
        let Actor = charactersToAddAbility[key];
        let updatedData = {
            [`data.abilities.${abilityCode}`]: newAbility
        };
        Actor.update(updatedData);
      })
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
    if (skillList.hasOwnProperty(skillKey)) {
      //add label to existing skill
      data.data.skills[skillKey].label = skillList[skillKey].label;
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
  CustomSkills.applyToSystem();
});