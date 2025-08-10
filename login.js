let divAcesso = document.getElementById('acesso')

divAcesso.querySelectorAll('input').forEach(input => {
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            acesso_login()
            event.preventDefault();
        }
    })
})

verificar_login_automatico()

function verificar_login_automatico() {
    try {
        if (acesso) {
            window.location.href = 'inicial.html'
        }
    } catch {
        console.log('Usuário deslogado')
    }
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

    let conteudo = `
            <div style="display: flex; column; gap: 10px; padding: 2vw;">

                <div id="camposCadastro" style="display: flex; flex-direction: column; justify-content: left; flex; text-align: left;">
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

                    <button onclick="salvarCadastro()">Criar acesso</button>
                </div>

            </div>`

    popup(conteudo, 'Cadastro')

}

document.getElementById('acesso_usuario').addEventListener('click', () => {
    acesso_login()
})

function acesso_login() {
    
    overlayAguarde()
    divAcesso.style.display = 'none'

    let inputs = divAcesso.querySelectorAll('input')

    let url = 'https://leonny.dev.br/acesso'

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

        let payload = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requisicao)
        }

        fetch(url, payload)

            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {

                if (data.permissao == 'novo') {
                    popup(mensagem('Alguém do setor de SUPORTE precisa autorizar sua entrada!'), 'ALERTA', true)
                } else if (data.permissao !== 'novo') {
                    localStorage.setItem('acesso', JSON.stringify(data));
                    window.location.href = 'inicial.html';
                }

                divAcesso.style.display = 'flex'

            })
            .catch(data => {
                popup(mensagem(data.erro), 'ALERTA', true);
                divAcesso.style.display = 'flex'
            });

    }
}

// NOVO USUÁRIO ; 

function salvarCadastro() {

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

        let payload = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requisicao)
        }

        fetch('https://leonny.dev.br/acesso', payload)
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(data => {

                console.log(data)

                switch (true) {
                    case data.erro:
                        popup(mensagem(data.erro), 'AVISO', true);
                        break;
                    case data.permissao == 'novo':
                        popup(mensagem('Seu cadastro foi realizado! Alguém do setor de SUPORTE precisa autorizar sua entrada!'), 'ALERTA')
                        break;
                    default:
                        popup(mensagem('Servidor Offline... fale com o Setor de Programação'), 'AVISO', true);
                }

            })
            .catch(error => {
                popup(mensagem(error.erro), 'AVISO', true);
            });

    }

}