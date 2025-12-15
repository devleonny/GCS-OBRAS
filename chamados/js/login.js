function telaLogin() {

    const app = localStorage.getItem('app')
    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (acesso) {

        if (app == 'GCS') return window.location.href = '../index.html'
        return telaPrincipal()

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

                    <label>Usuário</label>
                    <input type="text" placeholder="Usuário">

                    <label>Senha</label>
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
                localStorage.setItem('acesso', JSON.stringify(data));
                acesso = data
                await telaPrincipal()
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
async function salvarCadastro() {

    overlayAguarde()

    let camposCadastro = document.querySelector('.camposCadastro')
    let campos = camposCadastro.querySelectorAll('input')
    let nome_completo = campos[0].value
    let usuario = campos[1].value
    let senha = campos[2].value
    let email = campos[3].value
    let telefone = campos[4].value

    if (usuario == "" || senha == "" || email == "") {

        popup(mensagem('Senha, usuário ou e-mail não informado(s)'), 'AVISO', true)

    } else {

        let requisicao = {
            tipoAcesso: 'cadastro',
            dados: {
                usuario,
                senha,
                email,
                nome_completo,
                telefone
            }
        }

        try {
            const response = await fetch(`${api}/acesso`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requisicao)
            })
            if (!response.ok) {
                const err = await response.json()
                throw err
            }

            const data = await response.json()
            return popup(mensagem(data.mensagem), 'Alerta');

        } catch (e) {
            popup(mensagem(e), 'Alerta', true);
        }

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