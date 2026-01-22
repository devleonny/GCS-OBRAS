async function telaLogin() {

    atribuirVariaveis()

    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (acesso) {
        app = localStorage.getItem('app')
        if (app == 'GCS') 
            return await telaInicial()
        
        return await telaPrincipal()
    }

    const tLogin = document.querySelector('.loginBloco')
    if (tLogin) return

    toolbar.style.display = 'none'

    const acumulado = `
        <div id="acesso" class="loginBloco">

            <div class="botaoSuperiorLogin">
                <span>Painel de acesso ao GCS</span>
            </div>

            <div class="baixoLogin">

                <img src="imagens/GrupoCostaSilva.png" class="cadeado">
                
                <div class="credenciais">

                    <label>Digite seu usuário</label>
                    <input type="text" placeholder="Usuário">

                    <label>Digite sua senha</label>
                    <div style="${horizontal}; gap: 10px;">
                        <input type="password" placeholder="Senha">
                        <img src="imagens/olhoFechado.png" class="olho" onclick="exibirSenha(this)">
                    </div>

                    <br>

                    <span onclick="recuperarSenha()" style="text-decoration: underline; cursor: pointer;">Esqueceu sua senha?</span>

                </div>

                <br>

            </div>

            <div class="rodape-padrao">
                <label class="botoes-rodape" style="color: white; background-color: #249f41;" onclick="acessoLogin()">Entrar</label>
                <label class="botoes-rodape" style="color: white; background-color: #097fe6;" onclick="cadastrar()">Cadastrar</label>
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
                priExeOcorr = true
                app = permCham.includes(acesso.permissao) ? 'OCORRÊNCIAS' : 'GCS'
                localStorage.setItem('app', app)
                localStorage.setItem('acesso', JSON.stringify(data))

                await connectWebSocket()

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
        const linhas = [
            {
                texto: 'Preencha com os números recebidos no e-mail',
                elemento: `
                <div style="${vertical}; gap: 2px;">
                    <input id="identificador" style="display: none;" value="${identificador.value}">
                    <input id="codigo" placeholder="Código" class="camp-1" type="number">
                    <input id="novaSenha" placeholder="Nova Senha" class="camp-1">
                </div>`
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

    overlayAguarde()

    const identificador = document.getElementById('identificador').value
    const novaSenha = document.getElementById('novaSenha').value
    const codigo = document.getElementById('codigo').value

    const resposta = await salvarNovaSenha({ identificador, novaSenha, codigo })

    if (resposta.success) {
        removerPopup()
        popup({ mensagem: resposta.mensagem, imagem: 'imagens/concluido.png' })
        return
    }

    if (resposta.mensagem) popup({ mensagem: resposta.mensagem })

}

// NOVO USUÁRIO;

function cadastrar() {

    const campos = ['nome_completo', 'usuario', 'senha', 'e-mail', 'telefone']
    const linhas = []

    campos.forEach(campo => {
        linhas.push({
            texto: inicialMaiuscula(campo),
            elemento: `<input name="${campo}">`
        })
    })

    const funcao = `salvarCadastro()`

    const botoes = [
        { texto: 'Criar Acesso', img: 'concluido', funcao }
    ]

    popup({ linhas, botoes, titulo: 'Cadastro' })

}

async function salvarCadastro() {

    overlayAguarde()

    const obVal = (n) => {
        const el = document.querySelector(`[name="${n}"]`)
        return el ? el.value : ''
    }

    const dados = {
        nome_completo: obVal('nome_completo'),
        usuario: obVal('usuario'),
        senha: obVal('senha'),
        email: obVal('e-mail'),
        telefone: obVal('telefone')
    }

    if (dados.usuario == '' || dados.senha == '' || dados.email == '')
        return popup({ mensagem: 'Senha, usuário ou e-mail não informado(s)' })

    try {
        const response = await fetch(`${api}/acesso`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipoAcesso: 'cadastro', dados })
        })
        if (!response.ok) {
            const err = await response.json()
            throw err
        }

        const data = await response.json()
        removerPopup()
        return popup({ mensagem: data.mensagem })

    } catch (err) {
        popup({ mensagem: err.message })
    }

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