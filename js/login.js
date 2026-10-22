async function telaLogin() {

    atribuirVariaveis()

    if (acesso?.token)
        return await telaInicialGCS()

    const tLogin = document.querySelector('.login-bloco')
    if (tLogin) return

    toolbar.style.display = 'none'

    const acumulado = `
        <div class="tela-login">

            <div id="acesso" class="login-bloco">

                <div class="botaoSuperiorLogin">
                    <span>Painel de acesso ao GCS</span>
                </div>

                <div class="baixo-login">

                    <img src="imagens/GrupoCostaSilva.png" class="cadeado">
                    
                    <div class="credenciais">

                        <label>Digite seu usuário</label>
                        <input type="text" placeholder="Usuário">

                        <label>Digite sua senha</label>
                        <div style="${horizontal}; gap: 10px;">
                            <input onkeydown="if (event.key === 'Enter') acessoLogin()" type="password" placeholder="Senha">
                            <img src="imagens/olhoFechado.png" class="olho" onclick="exibirSenha(this)">
                        </div>

                        <br>

                        <span onclick="recuperarSenha()" style="text-decoration: underline; cursor: pointer;">Esqueceu sua senha?</span>

                    </div>

                    <br>

                </div>

                <div class="rodape-padrao">
                    <label class="botoes-rodape" style="color: white; background-color: #249f41;" onclick="acessoLogin()">Entrar</label>
                </div>

            </div>

        </div>
    `

    tela.innerHTML = acumulado
}

async function acessoLogin() {

    overlayAguarde()
    const divAcesso = document.getElementById('acesso')
    divAcesso.style.display = 'none'

    const inputs = divAcesso.querySelectorAll('input')
    const url = `${api}/acesso`

    if (inputs[0].value == '' || inputs[1].value == '') {
        popup({ mensagem: 'Senha e/ou usuário não informado(s)' })
        divAcesso.style.display = 'flex'

    } else {

        const requisicao = {
            tipoAcesso: 'login',
            dados: {
                usuario: inputs[0].value,
                senha: inputs[1].value
            }
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requisicao)
            })
            if (!response.ok) {
                const err = await response.json()
                throw err
            }

            const data = await response.json()

            if (data.mensagem) {
                divAcesso.style.display = 'flex'
                return popup({ mensagem: data.mensagem });

            } else if (data.usuario) {

                acesso = data
                priExeGCS = true
                localStorage.setItem('acesso', JSON.stringify(data))

                connectWebSocket()

            }

        } catch (err) {
            divAcesso.style.display = 'flex'
            popup({ mensagem: err.message || `Falha ao acessar o sistema, tente novamente em instantes` })
        }
    }
}

function recuperarSenha() {

    const linhas = [
        {
            texto: 'Digite o Usuário',
            elemento: `<input name="identificador">`
        }
    ]

    const botoes = [
        { texto: 'Solicitar Código', img: 'chave', funcao: `solicitarCodigo()` }
    ]

    popup({ linhas, botoes, titulo: 'Recuperar acesso' })

}

async function solicitarCodigo() {

    const identificador = document.querySelector('[name="identificador"]')
    if (!identificador) return

    overlayAguarde()

    const resposta = await recAC(identificador.value)

    if (resposta.success) {

        removerPopup()
        const usuario = escaparAtributo(identificador.value)
        const linhas = [
            {
                elemento: `
                <div style="text-align: left; line-height: 1.5; width: 100%; max-width: 360px;">
                    Enviamos um código de 6 dígitos para o e-mail cadastrado do usuário <b>${usuario}</b>.
                    <br><small style="color: #65756b;">Ele vale por 10 minutos. Não chegou? Confira o lixo eletrônico.</small>
                    <input name="identificador" type="hidden" value="${usuario}">
                </div>`
            },
            {
                texto: 'Código',
                elemento: `<input name="codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000">`
            },
            {
                texto: 'Nova senha',
                elemento: `<input name="novaSenha" type="password" autocomplete="new-password" placeholder="Nova senha">`
            },
            {
                texto: 'Repita a nova senha',
                elemento: `<input name="confirmarSenha" type="password" autocomplete="new-password" placeholder="Repita a nova senha">`
            },
            {
                elemento: `<small style="color: #65756b; text-align: left;">${REGRA_SENHA}</small>`
            }
        ]

        const botoes = [
            { texto: 'Confirmar', img: 'concluido', funcao: `salvarSenha()` }
        ]

        popup({ linhas, botoes, titulo: 'Recuperar acesso' })

    } else {
        popup({ mensagem: resposta.mensagem || 'Falha na solicitação' })
    }

}

async function salvarSenha() {

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const valor = nome => painel?.querySelector(`[name="${nome}"]`)?.value?.trim() || ''

    const identificador = valor('identificador')
    const codigo = valor('codigo')
    const novaSenha = painel?.querySelector('[name="novaSenha"]')?.value || ''

    if (!/^\d{6}$/.test(codigo))
        return popup({ mensagem: 'Digite os 6 números do código recebido no e-mail.' })

    if (novaSenha !== (painel?.querySelector('[name="confirmarSenha"]')?.value || ''))
        return popup({ mensagem: 'A confirmação não confere com a nova senha.' })

    if (novaSenha.length < 8)
        return popup({ mensagem: REGRA_SENHA })

    overlayAguarde()

    const resposta = await salvarNovaSenha({ identificador, novaSenha, codigo })

    if (resposta.success) {
        removerPopup()
        popup({ mensagem: resposta.mensagem, imagem: 'imagens/concluido.png' })
        return
    }

    if (resposta.mensagem) popup({ mensagem: resposta.mensagem })

}

async function recAC(identificador) {

    const url = `${api}/recuperar`

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identificador })
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        return data

    } catch (erro) {
        return { mensagem: erro }
    }

}

async function salvarNovaSenha({ identificador, novaSenha, codigo }) {

    const url = `${api}/verificar-codigo`

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identificador, novaSenha, codigo })
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        return data

    } catch (erro) {
        return { mensagem: erro }
    }

}