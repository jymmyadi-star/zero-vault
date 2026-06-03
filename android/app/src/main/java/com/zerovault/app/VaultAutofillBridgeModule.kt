package com.zerovault.app

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VaultAutofillBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VaultAutofillBridge"

    @ReactMethod
    fun setDbKey(key: String) {
        val prefs = reactApplicationContext.getSharedPreferences(
            "zerovault_autofill",
            Context.MODE_PRIVATE
        )
        prefs.edit().putString("db_key", key).apply()
    }

    @ReactMethod
    fun clearDbKey() {
        val prefs = reactApplicationContext.getSharedPreferences(
            "zerovault_autofill",
            Context.MODE_PRIVATE
        )
        prefs.edit().remove("db_key").apply()
    }
}
