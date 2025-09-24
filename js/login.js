identificacaoUser()

function telaLogin() {

    const acumulado = `
        <div style="display: flex; flex-direction: column; gap: 10px; justify-content: center; align-items: center;">
            <img src="imagens/BG.png" style="width: 20vw;">

            <div id="acesso" class="login-container" style="display: flex; gap: 5px;">

                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">

                    <label>Usuário</label>
                    <input type="text" placeholder="Usuário">

                    <label>Senha</label>
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                        <input type="password" placeholder="Senha">
                        <img src="imagens/olhoFechado.png" style="width: 2vw; cursor: pointer;" onclick="exibirSenha(this)">
                    </div>
                    <button onclick="acessar()">Entrar</button>

                </div>

                <div style="display: flex; margin-left: 50px; justify-content: center; align-items: center;">
                    <div
                        style="display: flex; flex-direction: column; justify-content: left; align-items: center; padding: 10px;">
                        <label>Primeiro acesso?</label>
                        <button style="background-color:#097fe6;" onclick="cadastrar()">Cadastre-se</button>
                    </div>
                </div>

            </div>

        </div>
    `
    tela.innerHTML = acumulado

}

function exibirSenha(img) {
    let inputSenha = img.previousElementSibling

    if (inputSenha.type == 'password') {
        inputSenha.type = 'text'
        img.src = 'imagens/olhoAberto.png'
    } else {
        inputSenha.type = 'password'
        img.src = 'imagens/olhoFechado.png'
    }
}

function cadastrar() {

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 1rem;">

            <div id="camposCadastro" class="painel-cadastro">
                <label>Nome Completo</label>
                <input placeholder="Nome Completo">

                <label>Usuário</label>
                <input type="text" placeholder="Crie um usuário">

                <label>Senha</label>
                <input type="password" placeholder="Crie uma senha">

                <label>E-mail</label>
                <input type="email" placeholder="E-mail">

                <label>Celular</label>
                <input type="text" placeholder="Telefone">

                <hr style="width: 100%">

                <button onclick="salvarCadastro()">Criar acesso</button>
            </div>

        </div>`

    popup(acumulado, 'Cadastro')

}

async function acessar() {

    overlayAguarde()
    const divAcesso = document.getElementById('acesso')
    divAcesso.style.display = 'none'

    let inputs = divAcesso.querySelectorAll('input')

    if (inputs[0].value == '' || inputs[1].value == '') {
        popup(mensagem('Senha e/ou usuário não informado(s)'), 'ALERTA', true)
        divAcesso.style.display = 'flex'

    } else {

        let requisicao = {
            tipoAcesso: 'login',
            dados: {
                usuario: inputs[0].value,
                senha: inputs[1].value
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

            if (data.mensagem) {
                divAcesso.style.display = 'flex'
                return popup(mensagem(data.mensagem), 'Alerta', true);

            } else if (data.permissao && data.permissao !== 'novo') {
                localStorage.setItem('acesso', JSON.stringify(data));
                await identificacaoUser()
                removerPopup()
                document.querySelector('.toolbar-top').classList.remove('.offline')
            }

            divAcesso.style.display = 'flex'

        } catch (e) {
            popup(mensagem(e), 'Alerta', true);
        }

    }
}

// NOVO USUÁRIO ; 
async function salvarCadastro() {

    overlayAguarde()

    let camposCadastro = document.getElementById('camposCadastro')
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