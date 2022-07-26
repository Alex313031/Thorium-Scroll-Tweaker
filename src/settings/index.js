(function () {
    'use strict';

    var Settings_Mode;
    (function (Settings_Mode) {
        /* set these enum values to string values to be able to use them as strings too */
        Settings_Mode["Always"] = "Always";
        Settings_Mode["OnTriggerKeyPressed"] = "OnTriggerKeyPressed";
    })(Settings_Mode || (Settings_Mode = {}));
    var Settings_TriggerKey;
    (function (Settings_TriggerKey) {
        /* set these enum values to string values to be able to use them as strings too */
        Settings_TriggerKey["AltLeft"] = "AltLeft";
        Settings_TriggerKey["ShiftLeft"] = "ShiftLeft";
        Settings_TriggerKey["ControlLeft"] = "ControlLeft";
    })(Settings_TriggerKey || (Settings_TriggerKey = {}));
    var Settings = /** @class */ (function () {
        function Settings() {
        }
        Settings.Mode = Settings_Mode; // allows client files to write `Settings.Mode`
        Settings.TriggerKey = Settings_TriggerKey; // allows client files to write `Settings.TriggerKey`
        return Settings;
    }());

    var defaultSettings = {
        mode: Settings.Mode.OnTriggerKeyPressed,
        scrollSpeedMultiplier: 3,
        triggerKey: Settings.TriggerKey.AltLeft,
        ignoredUrls: []
    };

    //
    //
    // Variables
    //
    var i18n = chrome.i18n;
    var ignoredUrls;
    var mode;
    var modeDescription;
    var modeWarning;
    var saveButton;
    var scrollSpeedMultiplier;
    var triggerKey;
    var triggerKeyWarning;
    var currentSettings; // to enable / disable the 'Save' button based on form changes
    //
    // Init
    //
    document.addEventListener('DOMContentLoaded', function () {
        queryElements();
        loadLocalizedStrings();
        loadCurrentSettings();
        attachFormListeners();
    });
    //
    // Helpers
    //
    function attachFormListeners() {
        document.addEventListener('input', function () { return updateSaveButtonState(); });
        ignoredUrls.addEventListener('input', function (event) { return autoSizeTextArea(event.target); });
        mode.addEventListener('input', function () {
            updateModeDescription(Settings.Mode[mode.value]);
            updateModeWarning(Settings.Mode[mode.value]);
        });
        triggerKey.addEventListener('input', function () { return updateTriggerKeyWarning(Settings.TriggerKey[triggerKey.value]); });
        saveButton.addEventListener('click', save);
    }
    // Source: https://stackoverflow.com/a/25621277/1276306
    function autoSizeTextArea(textArea) {
        textArea.style.height = 'auto';
        var borderBottomWidth = getComputedStyle(textArea).getPropertyValue('border-bottom-width');
        var borderTopWidth = getComputedStyle(textArea).getPropertyValue('border-top-width');
        textArea.style.height = "calc(" + textArea.scrollHeight + "px + " + borderTopWidth + " + " + borderBottomWidth + ")";
    }
    function formValuesHaveChanged() {
        var formValues = getFormValues();
        var ignoredUrlsChanged = formValues.ignoredUrls.toString() !== currentSettings.ignoredUrls.toString();
        var modeChanged = formValues.mode !== currentSettings.mode;
        var scrollSpeedMultiplierChanged = formValues.scrollSpeedMultiplier !== currentSettings.scrollSpeedMultiplier;
        var triggerKeyChanged = formValues.triggerKey !== currentSettings.triggerKey;
        return ignoredUrlsChanged || modeChanged || scrollSpeedMultiplierChanged || triggerKeyChanged;
    }
    function getFormValues() {
        return {
            ignoredUrls: ignoredUrls.value.trim().split('\n'),
            mode: Settings.Mode[mode.value],
            scrollSpeedMultiplier: Number(scrollSpeedMultiplier.value),
            triggerKey: Settings.TriggerKey[triggerKey.value]
        };
    }
    function loadLocalizedStrings() {
        // scroll speeed multiplier
        var scrollSpeedMultiplierLabel = document.getElementById('scrollSpeedMultiplierLabel');
        scrollSpeedMultiplierLabel.innerHTML = i18n.getMessage('Settings_ScrollSpeedMultiplier_label');
        // mode
        var modeLabel = document.getElementById('modeLabel');
        modeLabel.innerHTML = i18n.getMessage('Settings_Mode_label');
        var modeOnTriggerKeyPressed = document.getElementById('modeOnTriggerKeyPressed');
        modeOnTriggerKeyPressed.innerHTML = i18n.getMessage('Settings_Mode_OnTriggerKeyPressed_label');
        var modeAlways = document.getElementById('modeAlways');
        modeAlways.innerHTML = i18n.getMessage('Settings_Mode_Always_label');
        modeWarning.innerHTML = i18n.getMessage('Settings_Mode_Always_warning');
        // trigger key
        var triggerKeyLabel = document.getElementById('triggerKeyLabel');
        triggerKeyLabel.innerHTML = i18n.getMessage('Settings_TriggerKey_label');
        var triggerKeyAltLeftOptionLabel = document.getElementById('triggerKeyAltLeftOptionLabel');
        triggerKeyAltLeftOptionLabel.innerHTML = i18n.getMessage('Settings_TriggerKey_AltLeft');
        var triggerKeyControlLeftOptionLabel = document.getElementById('triggerKeyControlLeftOptionLabel');
        triggerKeyControlLeftOptionLabel.innerHTML = i18n.getMessage('Settings_TriggerKey_ControlLeft');
        var triggerKeyShiftLeftOptionLabel = document.getElementById('triggerKeyShiftLeftOptionLabel');
        triggerKeyShiftLeftOptionLabel.innerHTML = i18n.getMessage('Settings_TriggerKey_ShiftLeft');
        // ignored urls
        var ignoredUrlsLabel = document.getElementById('ignoredUrlsLabel');
        ignoredUrlsLabel.innerHTML = i18n.getMessage('Settings_IgnoredUrls_label');
        // save button
        saveButton.innerHTML = i18n.getMessage('Settings_SaveButton_label');
    }
    function loadCurrentSettings() {
        chrome.storage.sync.get(defaultSettings, function (settings) {
            setFormValues(settings);
            setFormEnabled(true);
            currentSettings = settings;
            // cast `scrollSpeedMultiplier` to a Number since v2 stored a String
            currentSettings.scrollSpeedMultiplier = Number(currentSettings.scrollSpeedMultiplier);
        });
    }
    function queryElements() {
        mode = document.getElementById('mode');
        modeDescription = document.getElementById('modeDescription');
        modeWarning = document.getElementById('modeWarning');
        saveButton = document.getElementById('saveButton');
        scrollSpeedMultiplier = document.getElementById('scrollSpeedMultiplier');
        triggerKey = document.getElementById('triggerKey');
        triggerKeyWarning = document.getElementById('triggerKeyWarning');
        ignoredUrls = document.getElementById('ignoredUrls');
    }
    function save() {
        var formValues = getFormValues();
        chrome.storage.sync.set(formValues, function () {
            saveButton.disabled = true;
            currentSettings = formValues;
        });
    }
    function setFormEnabled(enabled) {
        var disabled = !enabled;
        ignoredUrls.disabled = disabled;
        mode.disabled = disabled;
        scrollSpeedMultiplier.disabled = disabled;
        triggerKey.disabled = disabled;
    }
    function setFormValues(settings) {
        ignoredUrls.value = settings.ignoredUrls.join('\n');
        mode.value = settings.mode;
        scrollSpeedMultiplier.value = settings.scrollSpeedMultiplier.toString();
        triggerKey.value = settings.triggerKey;
        updateModeDescription(settings.mode);
        updateModeWarning(settings.mode);
        updateTriggerKeyWarning(settings.triggerKey);
    }
    function updateModeDescription(mode) {
        modeDescription.innerHTML = i18n.getMessage("Settings_Mode_" + mode + "_description");
    }
    function updateModeWarning(mode) {
        modeWarning.classList.toggle('is-visible', mode === Settings.Mode.Always);
    }
    function updateSaveButtonState() {
        saveButton.disabled = !formValuesHaveChanged();
    }
    function updateTriggerKeyWarning(triggerKey) {
        var warningMessage = i18n.getMessage("Settings_TriggerKey_" + triggerKey + "_warning");
        triggerKeyWarning.innerHTML = warningMessage;
        triggerKeyWarning.classList.toggle('is-visible', warningMessage !== '');
    }

}());
