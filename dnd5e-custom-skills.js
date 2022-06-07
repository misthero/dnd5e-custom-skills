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

/**
 * CUSTOM SKILLS APPLICATION SETTINGS FORM
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
      let data = mergeObject({ abilities: CONFIG.DND5E.abilities }, this.reset ? CustomSkills.defaultSettings : CustomSkills.settings);
      console.log('getData ', data);
      console.log('getData options', options);
      return data;
  }

  onReset() {
      this.reset = true;
      this.render();
  }

  _updateObject(event, formData) {
      return __awaiter(this, void 0, void 0, function* () {
        let Form = mergeObject({},formData , { insertKeys: true, insertValues: true, overwrite: true });
        let formLenght = Object.keys(Form.customSkillList).length;
        let settingsLength =  Object.keys(CustomSkills.settings.customSkillList).length;
        
        const oldSettings = CustomSkills.settings;
        console.log('Form',Form);
        console.log('formData',formData);
        console.log('oldSettings',oldSettings);
        
        let newSkills;
        let newAbilities;
        let newSettings = mergeObject(oldSettings, Form);
        
        if (Form.skillNum < oldSettings.skillNum) {
          newSkills = mergeObject(Form.customSkillList, oldSettings.customSkillList, { insertKeys: false, insertValues: false, overwrite:false  });
          for (let removekey in oldSettings.customSkillList) {
            if (typeof newSkills[removekey] == 'undefined') {
              CustomSkills.removeSkillFromActors(removekey);
              applyToSystem(removekey);
            }
          }
        } else {
          newSkills = mergeObject(oldSettings.customSkillList, Form.customSkillList, { insertKeys: true, insertValues: true, overwrite:true });
        };
        
        for (let s in newSkills) {
          if(newSkills[s].applied)
            CustomSkills.addSkillToActors(s)
          else
            CustomSkills.removeSkillFromActors(s);
        }
        
        if (Form.abilitiesNum < oldSettings.abilitiesNum) {
          newAbilities = mergeObject(Form.customAbilitiesList, oldSettings.customAbilitiesList, { insertKeys: false, insertValues: false, overwrite:false  });
          for (let removekey in oldSettings.customAbilitiesList) {
            if (typeof newAbilities[removekey] == 'undefined') {
              CustomSkills.removeAbilityFromActors(removekey);
              applyToSystem(removekey);
            }
          }
        } else {
          newAbilities = mergeObject(oldSettings.customAbilitiesList, Form.customAbilitiesList, { insertKeys: true, insertValues: true, overwrite:true });
        };
        
        for (let a in newAbilities) {
          if(newAbilities[a].applied)
            CustomSkills.addAbilityToActor(a);
          else
            CustomSkills.removeAbilityFromActors(a);
        }
        
        console.log('newSkills',newSkills);
        console.log('newAbilities',newAbilities);
        newSettings.customSkillList = newSkills;
        newSettings.customAbilitiesList = newAbilities;
        
        yield game.settings.set(MODULE_NAME, 'settings', newSettings);

        CustomSkills.applyToSystem();
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


Hooks.on('init', () => {
    console.log('dnd5e-custom-skills init');
    //console.log('CONFIG.DND5E.abilites', CONFIG.DND5E.abilities); //default skills
    //CONFIG.debug.hooks = true;
    //game.dnd5e.config.skills['cus_0'] = 'Ombra';



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

    CustomSkills.applyToSystem();

});

class CustomSkills {

    static get settings() {
      let csSettings = mergeObject(this.defaultSettings, game.settings.get(MODULE_NAME, 'settings'));
      // skills
      const oldSkillNum = Object.keys(csSettings.customSkillList).length;
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
          abilitiesNum : abilitiesNum
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

    static getCustomSkillList() {
        let csSettings = CustomSkills.settings;
        return csSettings.customSkillList;
    }
    static getCustomAbilitiesList() {
        let csSettings = CustomSkills.settings;
        return csSettings.customAbilitiesList;
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
      
      if (typeof removeCode != 'undefined') {
        // removing leftover
        if (typeof systemSkills[removeCode] != 'undefined')
          systemSkills = CustomSkills.removeKey(systemSkills, removeCode);
        if (typeof systemAbilities[removeCode] != 'undefined')
          systemAbilities = CustomSkills.removeKey(systemAbilities, removeCode);
        if (typeof systemAbilityAbbr[removeCode] != 'undefined')
          systemAbilityAbbr = CustomSkills.removeKey(systemAbilityAbbr, removeCode);
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
          if (customAbilities[a].applied) {
            let label = customAbilities[a].label;
            systemAbilities[a] = label;
            systemAbilityAbbr[a] = a;
          } else {
            if (typeof systemAbilities[a] != "undefined") {
              systemAbilities = CustomSkills.removeKey(systemAbilities, a);
            }
            if (typeof systemAbilityAbbr[a] != "undefined") {
              systemAbilityAbbr = CustomSkills.removeKey(systemAbilityAbbr, a);
            }
          }
        }
      }
      
      // update system config
      game.dnd5e.config.skills = systemSkills;
      game.dnd5e.config.abilities = systemAbilities;
      game.dnd5e.config.abilityAbbreviations = systemAbilityAbbr;
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

    static addSkillToActors(skillCode) {
        let skillList = this.getCustomSkillList();
        let skillToAdd = skillList[skillCode];
        let characters = this.getPlayerActors();
        let charactersToAddSkill = characters.filter(s => s.data.data.skills.hasOwnProperty(skillCode) == false);
        const keys = Object.keys(charactersToAddSkill);
        
        if (keys.length > 0) {
            keys.forEach((key, index) => {
                let Actor = charactersToAddSkill[key];
                CustomSkills.debug('Adding skill "' + skillToAdd.label + '" to:' + Actor.name);
                let updatedData = {
                    [`data.skills.${skillCode}`]: skillToAdd
                };
                Actor.update(updatedData);
            })
        }
    }


    static removeSkillFromActors(skillCode) {
        let skillList = this.getCustomSkillList();
        let skillToRemove = skillList[skillCode];
        let characters = this.getPlayerActors();
        let charactersToRemoveSkills = characters.filter(s => s.data.data.skills.hasOwnProperty(skillCode));
        const keys = Object.keys(charactersToRemoveSkills);
        
        if (keys.length > 0) {
            keys.forEach((key, index) => {
                let Actor = charactersToRemoveSkills[key];
                CustomSkills.debug('Removing skill "' + skillToRemove.label + '" from:' + Actor.name);
                Actor.update({
                    ['data.skills.-=' + skillCode]: null
                });
            })
        }
    }
    
    static addAbilityToActor(abilityCode){
      const emptyAbility = game.system.template.Actor.templates.common.abilities.cha;
      const newAbility = foundry.utils.deepClone(emptyAbility);
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
    
    static removeAbilityFromActors(abilityCode) {
      console.log('REMOVE FROM ACTOR',abilityCode);
        let abilitiesList = this.getCustomAbilitiesList();
        let characters = this.getPlayerActors();
        let charactersToRemoveAbility = characters.filter(s => s.data.data.abilities.hasOwnProperty(abilityCode));
        const keys = Object.keys(charactersToRemoveAbility);
        
        if (keys.length > 0) {
            keys.forEach((key, index) => {
                let Actor = charactersToRemoveAbility[key];
                console.log('ACTOR BEFORE',Actor);
                Actor.update({
                    ['data.abilities.-=' + abilityCode]: null
                });
                console.log('ACTOR AFTER', Actor);
            })
        }
    }
}



function addLabels(app, html, data) {
    console.log('DND5E', game.dnd5e);
    console.log('data', data);

    html.find(".skills-list").addClass("custom-skills");
    html.find(".ability-scores").addClass("custom-abilities");

    const skillList = CustomSkills.getCustomSkillList();
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
    return (app, html, data);
}

function test(ActorSheet5eCharacter, html, data) {
    //game.dnd5e.config.skills['cus_0'] = 'Ombra';
}

Hooks.on("renderChatMessage", addChatLabels);

function addChatLabels(chatMessage, html) {
    //data.flags.betterrolls5e.fields[0][1].title = "ciao";
    //console.log('chatMessage', chatMessage);
}


//Hooks.on("renderActorSheet5eCharacter", test);
Hooks.on("renderActorSheet", addLabels);
//Hooks.on("hoverToken ", CustomSkills.applyToSystem());