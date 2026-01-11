async function telaLogin() {

    atribuirVariaveis()

    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (acesso) {
        const app = localStorage.getItem('app')
        if (app == 'GCS') return window.location.href = 'index.html'
        return await telaPrincipal()
    }

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

            <div class="rodape-login">
                <button onclick="acessoLogin()">Entrar</button>
                <button style="background-color: #097fe6;" onclick="cadastrar()">Cadastrar</button>
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
        popup(mensagem('Senha e/ou usuário não informado(s)'), 'Alerta', true)
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
                return popup(mensagem(data.mensagem), 'Alerta', true);

            } else if (data.usuario) {
                acesso = data
                const app = permCham.includes(acesso.permissao) ? 'OCORRÊNCIAS' : 'GCS'

                localStorage.setItem('app', app)
                localStorage.setItem('acesso', JSON.stringify(data))

                if (app == 'GCS') return window.location.href = 'index.html'

                indexedDB.deleteDatabase(nomeBaseCentral)
                await telaPrincipal()
                connectWebSocket()
                removerOverlay()
            }
        } catch (e) {
            divAcesso.style.display = 'flex'
            popup(mensagem(`${e}::lin106`), 'Alerta', true);
        }
    }
}

function recuperarSenha() {

    const acumulado = `
        <div class="painel-recuperacao">
            <span>Digite o Usuário</span>
            <input name="identificador">
            <hr>
            <button onclick="solicitarCodigo()">Solicitar</button>
        </div>
    `

    popup(acumulado, 'Recuperar acesso', true)

}

async function solicitarCodigo() {

    const identificador = document.querySelector('[name="identificador"]')

    if (!identificador) return

    overlayAguarde()

    const resposta = await recAC(identificador.value)

    if (resposta.sucess) {

        const acumulado = `
            <div class="painel-recuperacao">
                <span>Preencha com os números recebidos no e-mail</span>
                <hr>
                <div style="${horizontal}; gap: 0.5rem;">
                    <input id="identificador" style="display: none;" value="${identificador.value}">
                    <input id="codigo" placeholder="Código" class="camp-1" type="number">
                    <input id="novaSenha" placeholder="Nova Senha" class="camp-1">
                    <button onclick="salvarSenha()">Confirmar</button>
                </div>
            </div>
        `
        popup(acumulado, 'Informe o código')
    } else {
        popup(mensagem(resposta.mensagem || 'Falha na solicitação'), 'Alerta')
    }

}

async function salvarSenha() {

    overlayAguarde()

    const identificador = document.getElementById('identificador').value
    const novaSenha = document.getElementById('novaSenha').value
    const codigo = document.getElementById('codigo').value

    const resposta = await salvarNovaSenha({ identificador, novaSenha, codigo })

    if (resposta.sucess) {
        return popup(mensagem(resposta.mensagem), 'GCS')
    }

    if (resposta.mensagem) popup(mensagem(resposta.mensagem), 'GCS', true)

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

    const form = new formulario({ linhas, botoes, titulo: 'Cadastro' })
    form.abrirFormulario()

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

    if (dados.usuario == '' || dados.senha == '' || dados.email == '') return popup(mensagem('Senha, usuário ou e-mail não informado(s)'), 'Aviso', true)

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
        return popup(mensagem(data.mensagem), 'Alerta')

    } catch (err) {
        popup(mensagem(err.message), 'Alerta')
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