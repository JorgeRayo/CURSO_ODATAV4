sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History"
], (Controller, History) => {
    "use strict";

    return Controller.extend("com.inetum.cursoodatav4.controller.Detail", {
        /**
     * Método que se ejecuta cuando el controlador se inicializa.
     */
        onInit() {
            // Obtiene el enrutador de la aplicación desde el componente principal
            const oRouter = this.getOwnerComponent().getRouter();
            var that = this;

            this.getOwnerComponent().getService("ShellUIService").then(function (oShellService) {
                oShellService.setBackNavigation(async function () {
                    let oHistory = History.getInstance();
                    let sPreviousHash = oHistory.getPreviousHash();
                    let oView = that.getView();
                    let oParent = oView.getParent(); // Obtener el NavContainer

                    if (sPreviousHash !== undefined) {
                        window.history.go(-1);
                    } else {
                        that.getRouter().navTo("RouteMain");
                    }

                    if (oParent && oParent.removePage) {
                        console.log("🔄 Eliminando la vista de detalle sin destruirla");
                        oParent.removePage(oView);
                    }
                });
            });


            // Se suscribe al evento de coincidencia de la ruta "RouteDetail"
            oRouter.getRoute("RouteDetail").attachPatternMatched(this.onMatchedRoute, this);
        },

        /**
         * Método que se ejecuta cuando la ruta "RouteDetail" es activada.
         * @param {sap.ui.base.Event} oEvent - Evento de coincidencia de ruta.
         */
        onMatchedRoute: function (oEvent) {
            // Obtiene los parámetros de la URL
            const oArguments = oEvent.getParameter("arguments");
            const sKey = oArguments.key; // Clave del Travel

            // Obtiene el modelo local y limpia los datos previos
            const oModeloLocal = this.getView().getModel("modeloLocal");
            oModeloLocal.setProperty("/BookingLocal", []);
            oModeloLocal.setProperty("/TravelLocal", []);

            // Obtiene el modelo OData principal
            const oModel = this.getView().getModel();

            // PRIMERO: Obtener los Booking asociados al Travel
            oModel.bindList(`/Travel(${sKey})/_Booking`).requestContexts()
                .then(aBookingContexts => {
                    if (aBookingContexts.length > 0) {
                        let aData = aBookingContexts.map(oContext => oContext.getObject());
                        oModeloLocal.setProperty("/BookingLocal", aData);
                    } else {
                        console.warn(`No hay datos en _Booking para Travel(${sKey})`);
                    }
                })
                .catch(oError => {
                    console.error("Error al obtener _Booking:", oError);
                });

            // SEGUNDO: Obtener el Travel
            let oFilter = new sap.ui.model.Filter("TravelID", sap.ui.model.FilterOperator.EQ, sKey);

            oModel.bindList(`/Travel`).filter(oFilter).requestContexts()
                .then(aContexts => {
                    if (aContexts.length > 0) {
                        //let aData = aContexts.map(oContext => oContext.getObject());
                        let aData = [];
                        aContexts.forEach(oContext => {
                            if (oContext.getObject().Status !== "P") {
                                aData.push(oContext.getObject());
                            }
                        });
                        oModeloLocal.setProperty("/TravelLocal", aData);
                    }
                });

            console.log(oModeloLocal);
        },

        /**
         * Método que se ejecuta después de que la vista ha sido renderizada en el DOM.
         */
        onAfterRendering: function () {
            this.byId("panel01").setHeaderText("Cambio titulo onAfterRendering");
        },

        /**
         * Método que se ejecuta antes de que la vista ha sido renderizada en el DOM.
         */
        onBeforeRendering: function () {
            let random = Math.floor(Math.random() * 2)
            let sUserRole = ["admin", "user"];

            // Obtener el botón de la vista por su ID
            let oButton = this.byId("borrarRegistro");

            if (oButton) {
                if (sUserRole[random] === "admin") {
                    oButton.setVisible(true);
                } else {
                    oButton.setVisible(false);
                }
            }
        },

        /**
         * Alterna el estado de edición de los datos en el modelo local.
         */
        editarRegistro: function () {
            const oModeloLocal = this.getView().getModel("modeloLocal");
            let oEditable = oModeloLocal.getProperty("/Editable");
            oModeloLocal.setProperty("/Editable", !oEditable);
        },

        /**
         * Actualiza un registro existente en el backend OData V4.
         */
        updateRegistro: function () {
            let oModel = this.getView().getModel();
            let oBindList = oModel.bindList("/Travel");
            let oModeloLocal = this.getView().getModel("modeloLocal");
            let sObject = oModeloLocal.getProperty("/TravelLocal/0");
            let that = this;

            // Filtro para buscar el registro en el backend
            let aFilter = new sap.ui.model.Filter("TravelID", sap.ui.model.FilterOperator.EQ, sObject.TravelID);

            // Solicita los registros con el filtro y actualiza los datos
            oBindList.filter(aFilter).requestContexts()
                .then(aContexts => {
                    if (aContexts.length !== 0) {
                        //aContexts [7]
                        let oContext = aContexts[0];

                        // Actualiza los datos en el contexto de OData V4
                        oContext.setProperty("BeginDate", sObject.BeginDate);
                        oContext.setProperty("EndDate", sObject.EndDate);
                        oContext.setProperty("BookingFee", sObject.BookingFee);
                        oContext.setProperty("TotalPrice", sObject.TotalPrice);
                        oContext.setProperty("CurrencyCode", sObject.CurrencyCode);
                        oContext.setProperty("Memo", sObject.Memo);
                        oContext.setProperty("Status", sObject.Status);

                        return oContext.getModel().submitBatch("updateGroup");
                    }
                })
                .then(() => {
                    // Éxito en la actualización
                    oModeloLocal.setProperty("/Editable", false);
                    sap.m.MessageBox.success(
                        that.getView().getModel("i18n").getResourceBundle().getText("successUpdate"),
                        {
                            title: that.getView().getModel("i18n").getResourceBundle().getText("successUpdateTitle")
                        }
                    );
                })
                .catch(oError => {
                    // Captura de errores en setProperty() o en submitBatch()
                    console.error("Error en la actualización:", oError);
                    oModeloLocal.setProperty("/Editable", false);
                    sap.m.MessageBox.error(
                        that.getView().getModel("i18n").getResourceBundle().getText("errorUpdate") + " " + oError.message,
                        {
                            title: that.getView().getModel("i18n").getResourceBundle().getText("errorUpdateTitle")
                        }
                    );
                });
        },

        /**
         * Elimina un registro en el backend OData V4.
         */
        borrarRegistro: function () {
            let oModel = this.getView().getModel();
            let oBindList = oModel.bindList("/Travel");
            let oModeloLocal = this.getView().getModel("modeloLocal");
            let sObject = oModeloLocal.getProperty("/TravelLocal/0");
            let that = this;

            // Filtro para buscar el registro a eliminar
            let aFilter = new sap.ui.model.Filter("TravelID", sap.ui.model.FilterOperator.EQ, sObject.TravelID);

            // Solicita los registros con el filtro y elimina el primero encontrado
            oBindList.filter(aFilter).requestContexts()
                .then(aContexts => {
                    if (aContexts.length > 0) {
                        aContexts[0].delete();
                        aContexts[0].getModel().submitBatch("updateGroup");
                    } else {
                        throw new Error("No se encontró el registro a eliminar.");
                    }
                })
                .then(() => {
                    // Éxito en la eliminación
                    oModeloLocal.setProperty("/Editable", false);
                    sap.m.MessageBox.success(
                        that.getView().getModel("i18n").getResourceBundle().getText("successDelete"),
                        {
                            title: that.getView().getModel("i18n").getResourceBundle().getText("successDeleteTitle"),
                            onClose: function () {
                                that.getRouter().navTo("RouteMain"); // Navegar de regreso a la vista principal
                            }
                        }
                    );
                })
                .catch(oError => {
                    // Captura de errores en la eliminación
                    console.error("Error en la eliminación:", oError);
                    oModeloLocal.setProperty("/Editable", false);
                    sap.m.MessageBox.error(
                        that.getView().getModel("i18n").getResourceBundle().getText("errorDelete") + " " + oError.message,
                        {
                            title: that.getView().getModel("i18n").getResourceBundle().getText("errorDeleteTitle")
                        }
                    );
                });
        },

        /**
         * Devuelve el router para las opciones de navegación.
         * @returns {sap.ui.core.routing.Router} - El objeto del router.
         */
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        }
    });
});