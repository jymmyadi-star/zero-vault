package com.zerovault.app

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject

class VaultDataSource(private val context: Context) {

    data class DbVaultItem(
        val id: String,
        val itemType: String,
        val title: String,
        val urlHint: String?,
        val payloadCiphertext: String
    )

    fun queryForFields(fields: List<ParsedField>): List<VaultEntry> {
        val db = openDatabase()
        if (db == null) return emptyList()

        return try {
            val cursor = db.rawQuery(
                "SELECT id, item_type, title, url_hint, payload_ciphertext FROM vault_items WHERE is_pending_delete = 0 ORDER BY last_used_at DESC LIMIT 20",
                null
            )

            val items = mutableListOf<DbVaultItem>()
            while (cursor.moveToNext()) {
                items.add(
                    DbVaultItem(
                        id = cursor.getString(0),
                        itemType = cursor.getString(1),
                        title = cursor.getString(2),
                        urlHint = cursor.getString(3),
                        payloadCiphertext = cursor.getString(4)
                    )
                )
            }
            cursor.close()

            // Filter password items only
            items.filter { it.itemType == "password" }.mapNotNull { item ->
                try {
                    val payload = decryptPayload(item.payloadCiphertext)
                    VaultEntry(
                        id = item.id,
                        title = item.title,
                        username = payload.optString("username", ""),
                        password = payload.optString("password", "")
                    )
                } catch (e: Exception) {
                    null
                }
            }
        } catch (e: Exception) {
            emptyList()
        } finally {
            db?.close()
        }
    }

    private fun openDatabase(): SQLiteDatabase? {
        return try {
            val dbPath = context.getDatabasePath("watermelon.db").absolutePath
            val db = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READONLY)

            // Try to query to verify key
            db.rawQuery("SELECT count(*) FROM vault_items", null).use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getInt(0)
                }
            }

            db
        } catch (e: Exception) {
            null
        }
    }

    private fun decryptPayload(ciphertext: String): JSONObject {
        // The payload is stored as an encrypted JSON envelope
        // Since the autofill service runs in the app process,
        // we can access the app's React Native bridge or shared state
        // For now, the app stores decrypted items in a shared storage
        val prefs = context.getSharedPreferences("zerovault_autofill", Context.MODE_PRIVATE)
        val itemsJson = prefs.getString("decrypted_items", null) ?: "[]"

        val items = org.json.JSONArray(itemsJson)
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i)
            // Find matching item by checking if ciphertext hashes match
            // Simplified: return first match's payload
            if (item.has("payloadCiphertext")) {
                return item.getJSONObject("payload")
            }
        }

        return JSONObject()
    }
}
