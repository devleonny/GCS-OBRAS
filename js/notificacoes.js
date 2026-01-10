function notificacoes(titulo, texto) {

    const notificacao = {
        id: new Date().getTime(),
        title: titulo,
        text: texto,
        smallIcon: "res://icon",
        foreground: true
    }

    if (isAndroid) {

        cordova.plugins.notification.local.schedule(notificacao)

        cordova.plugins.notification.local.on("click", function (notification, state) {
           telaPrincipal()
        });

        return

    } else {

        popupNotificacao(`${titulo} - ${texto}`)

    }

}

