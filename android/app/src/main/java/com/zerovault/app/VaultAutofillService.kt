package com.zerovault.app

import android.app.assist.AssistStructure
import android.app.assist.AssistStructure.ViewNode
import android.content.Context
import android.os.Build
import android.service.autofill.*
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import androidx.annotation.RequiresApi
import android.widget.RemoteViews
import com.facebook.react.bridge.*

@RequiresApi(Build.VERSION_CODES.O)
class VaultAutofillService : AutofillService() {

    override fun onConnected() {
        super.onConnected()
    }

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: android.os.CancellationSignal,
        callback: FillCallback
    ) {
        val context: List<FillContext> = request.fillContexts
        val structure: AssistStructure = context[context.size - 1].structure

        val parser = StructureParser(structure)
        val parsedFields = parser.parse()

        if (parsedFields.isEmpty()) {
            callback.onSuccess(null)
            return
        }

        // Query the vault for matching credentials
        val vaultItems = queryVault(parsedFields)

        if (vaultItems.isEmpty()) {
            callback.onSuccess(null)
            return
        }

        val response = buildFillResponse(parsedFields, vaultItems, structure)
        callback.onSuccess(response)
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val context: List<FillContext> = request.fillContexts
        // Future: save new credentials to vault
        callback.onSuccess()
    }

    private fun queryVault(fields: List<ParsedField>): List<VaultEntry> {
        return try {
            val dataSource = VaultDataSource(this)
            dataSource.queryForFields(fields)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun buildFillResponse(
        fields: List<ParsedField>,
        entries: List<VaultEntry>,
        structure: AssistStructure
    ): FillResponse {
        val response = FillResponse.Builder()

        for (entry in entries) {
            val dataset = Dataset.Builder()

            for (field in fields) {
                when {
                    field.isUsername || field.hint == "username" || field.hint == "email" -> {
                        if (entry.username.isNotEmpty()) {
                            dataset.setValue(
                                field.autofillId,
                                AutofillValue.forText(entry.username),
                                createPresentation(entry.title, entry.username)
                            )
                        }
                    }
                    field.isPassword -> {
                        if (entry.password.isNotEmpty()) {
                            dataset.setValue(
                                field.autofillId,
                                AutofillValue.forText(entry.password),
                                createPresentation(entry.title, "••••••••")
                            )
                        }
                    }
                }
            }

            response.addDataset(dataset.build())
        }

        // Add save info for unknown credentials
        val saveInfo = SaveInfo.Builder(
            SaveInfo.SAVE_DATA_TYPE_PASSWORD,
            arrayOf(
                fields.find { it.isUsername }?.autofillId,
                fields.find { it.isPassword }?.autofillId
            ).filterNotNull().toTypedArray()
        ).build()
        response.setSaveInfo(saveInfo)

        return response.build()
    }

    private fun createPresentation(title: String, subtitle: String): RemoteViews {
        val views = RemoteViews(packageName, android.R.layout.simple_list_item_2)
        views.setTextViewText(android.R.id.text1, title)
        views.setTextViewText(android.R.id.text2, subtitle)
        return views
    }
}

class ParsedField(
    val autofillId: AutofillId,
    val hint: String,
    val isUsername: Boolean,
    val isPassword: Boolean
)

class VaultEntry(
    val id: String,
    val title: String,
    val username: String,
    val password: String
)

class StructureParser(private val structure: AssistStructure) {

    fun parse(): List<ParsedField> {
        val fields = mutableListOf<ParsedField>()
        val nodeCount = structure.windowNodeCount

        for (i in 0 until nodeCount) {
            val node = structure.getWindowNodeAt(i)
            parseNode(node.rootViewNode, fields)
        }

        return fields.distinctBy { it.autofillId }
    }

    private fun parseNode(node: ViewNode, fields: MutableList<ParsedField>) {
        val autofillId = node.autofillId
        if (autofillId != null) {
            val isPassword = node.inputType and 0x00000080 != 0 ||
                    (node.htmlInfo?.tag == "input" && node.htmlInfo?.attributes
                        ?.find { it.first == "type" }?.second == "password")

            val isUsername = (node.htmlInfo?.tag == "input" &&
                    (node.htmlInfo?.attributes?.find { it.first == "type" }?.second in listOf("text", "email"))) ||
                    node.hint?.lowercase()?.contains("email") == true ||
                    node.hint?.lowercase()?.contains("username") == true ||
                    node.hint?.lowercase()?.contains("user") == true

            if (isPassword || isUsername) {
                fields.add(
                    ParsedField(
                        autofillId = autofillId,
                        hint = node.hint ?: "",
                        isUsername = isUsername,
                        isPassword = isPassword
                    )
                )
            }
        }

        for (j in 0 until node.childCount) {
            parseNode(node.getChildAt(j), fields)
        }
    }
}
