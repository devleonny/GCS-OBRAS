function telaLogin() {

    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (acesso && !isAndroid) {
        return window.location.href = '../index.html'
    }

    if (acesso && isAndroid) {
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
        popup(mensagem('Senha e/ou usuário não informado(s)'), 'ALERTA', true)
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
                telaPrincipal()
                removerOverlay()
            }

        } catch (e) {
            divAcesso.style.display = 'flex'
            popup(mensagem(e), 'Alerta', true);
        }

    }
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