sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
], (Controller, FilterOperator, JSONModel, Fragment, MessageToast) => {
    "use strict";

    // Definimos el controlador principal del módulo "Main"
    return Controller.extend("com.inetum.cursoodatav4.controller.Main", {
        /**
         * Método que se ejecuta al inicializar el controlador.
         */
        onInit() {
            // Obtenemos el enrutador de la aplicación desde el componente principal
            const oRouter = this.getOwnerComponent().getRouter();

            // Asociamos el evento de coincidencia de ruta para ejecutar una función cuando se navegue a esta vista
            oRouter.getRoute("RouteMain").attachPatternMatched(this.onMatchedRoute, this);

            // Creamos un modelo JSON para manejar los datos del diálogo de creación de Travel
            const oDialogModel = new JSONModel({
                AgencyID: "",
                CustomerID: "",
                BeginDate: "",
                EndDate: ""
            });

            // Asignamos el modelo JSON a la vista con el alias "dialogModel"
            this.getView().setModel(oDialogModel, "dialogModel");
        },

        /**
         * Método que se ejecuta después de que la vista ha sido renderizada en el DOM.
         */
        onAfterRendering: function () {
            console.log("onAfterRendering - La vista ha sido renderizada");
        },

        /**
         * Método que se ejecuta antes de que la vista sea renderizada en el DOM.
         */
        onBeforeRendering: function () {
            console.log("onBeforeRendering - La vista está a punto de renderizarse");
        },

        /**
         * Se ejecuta cuando la ruta "RouteMain" es activada.
         * @param {sap.ui.base.Event} oEvent - Evento de coincidencia de ruta
         */
        onMatchedRoute: function (oEvent) {
            // Refrescamos el modelo de datos para obtener la información más reciente
            this.getView().getModel().refresh();
        },

        /**
         * Filtra los registros de la tabla en base a los valores ingresados en los campos de búsqueda.
         */
        onSearch: function () {
            // Obtenemos la tabla y su binding de datos
            let oTable = this.byId("idProductsTable");
            let aItems = oTable.getBinding("items");

            // Inicializamos el array de filtros
            let aFilter = [];

            // Obtenemos los valores ingresados en los campos de búsqueda
            let sTravelID = this.byId("travelID").getValue();
            let sBeginDatePicker = this.byId("BeginDatePicker").getValue();
            sBeginDatePicker = this.convertirFecha(sBeginDatePicker);

            // Si se ha ingresado un TravelID, agregamos un filtro de igualdad
            if (sTravelID) {
                aFilter.push(new sap.ui.model.Filter("TravelID", sap.ui.model.FilterOperator.EQ, sTravelID));
            }

            // Si se ha ingresado una fecha de inicio, agregamos un filtro de igualdad
            if (sBeginDatePicker) {
                aFilter.push(new sap.ui.model.Filter("BeginDate", sap.ui.model.FilterOperator.EQ, sBeginDatePicker));
            }

            // Aplicamos los filtros a la tabla
            aItems.filter(aFilter);

            // Si no hay filtros, restablecemos los datos de la tabla
            if (aFilter.length === 0) {
                aItems.filter([]);
            }
        },

        /**
         * Maneja el evento de clic en un registro de la tabla y navega a la vista de detalles.
         * @param {sap.ui.base.Event} oEvent - Evento de clic en la fila
         */
        onPress: function (oEvent) {
            // Obtenemos el identificador del Travel seleccionado
            const oKey = oEvent.getSource().getBindingContext().getObject().TravelID;

            // Navegamos a la ruta de detalle con el identificador seleccionado
            this.getRouter().navTo("RouteDetail", { "key": `'${oKey}'` });
        },

        /**
         * Abre el diálogo de creación de un nuevo Travel.
         */
        onPressCreate: function () {
            let oView = this.getView();

            // Cargar el fragmento solo si no existe
            if (!this.oDialog) {
                this.oDialog = Fragment.load({
                    id: oView.getId(), // Asigna el fragmento a la vista actual
                    name: "com.inetum.cursoodatav4.fragments.common.Create",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            // Reiniciamos el modelo del diálogo antes de abrirlo
            this.oDialog.then(function (oDialog) {
                let oDialogModel = oView.getModel("dialogModel");
                oDialogModel.setData({
                    AgencyID: "",
                    CustomerID: "",
                    BeginDate: "",
                    EndDate: ""
                });
                oDialog.open();
            });
        },

        /**
         * Cierra el diálogo de creación.
         */
        onDialogClose: function () {
            this.oDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        /**
         * Guarda el nuevo Travel en el backend OData V4.
         */
        onSaveTravel: function () {
            // Obtenemos el modelo principal de la vista
            const oModel = this.getView().getModel();

            // Obtenemos los datos ingresados en el diálogo
            const oDialogModel = this.getView().getModel("dialogModel");
            const oData = oDialogModel.getData();
            
            // Convertimos las fechas al formato adecuado para OData V4
            oData.BeginDate = this.convertirFecha(oData.BeginDate);
            oData.EndDate = this.convertirFecha(oData.EndDate);

            // Creamos un nuevo registro en OData V4 usando bindList().create()
            const oBindList = oModel.bindList("/Travel");
            let oContext = oBindList.create(oData);

            oContext.getModel().submitBatch("updateGroup");

            oContext.created().then(() => {
                MessageToast.show("Travel created successfully!");
                this.onDialogClose();
            }).catch(oError => {
                console.error("Error creating Travel:", oError);
                MessageToast.show("Failed to create Travel.");
            });
        },

        /**
         * Convierte una fecha de SAPUI5 en un formato compatible con OData V4.
         * @param {string} sDate - Fecha en formato SAPUI5
         * @returns {string|null} Fecha en formato "YYYY-MM-DD" o null si está vacía
         */
        convertirFecha: function (sDate) {
            if (!sDate) return null; // Si la fecha está vacía, retornamos null

            let oDate = new Date(sDate);

            // Extraer año, mes y día asegurando siempre dos dígitos
            let iYear = oDate.getFullYear();
            let iMonth = (oDate.getMonth() + 1).toString().padStart(2, '0');
            let iDay = oDate.getDate().toString().padStart(2, '0');

            return `${iYear}-${iMonth}-${iDay}`; // Formato estándar "YYYY-MM-DD"
        },

        /**
         * Devuelve la instancia del enrutador.
         * @returns {sap.ui.core.routing.Router} Enrutador de la aplicación
         */
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        }
    });

});