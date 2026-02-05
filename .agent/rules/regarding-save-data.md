---
trigger: always_on
---

When a new setting is added, the Flashcardsish `config.json` file that is saved to user accounts must also be updated. Please ensure that, if you add or change the settings, the config file updates. Further, Flashcardsish is continuiously updated, and updates to the config file must not break one’s “old” file. 

To accomplish this, the config file is a JSON. You may add keys to this JSON, and when you do so you should append them to the end, of the key/category, not slot them in randomly. 

The same applies to `structure.json`.