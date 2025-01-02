let div_acesso = document.getElementById('acesso')

document.getElementById('senha').addEventListener('keydown', function (event) {

    if (event.key === 'Enter') {

        acesso_login()
        event.preventDefault();

    }

})

verificar_login_automatico()

function verificar_login_automatico() {

    try {

        let acesso = JSON.parse(localStorage.getItem('acesso'))
        if (acesso.acesso == 'Autorizado') {

            window.location.href = '/htmls/inicial.html'

        }

    } catch {

        console.log('Usuário deslogado')

    }

}

function alternar_telas(tela) {

    div_acesso.innerHTML = ''

    let conteudo = ''

    if (tela == 'novo') {

        conteudo = `

            <div style="display: flex; column; gap: 10px;">
                <div style="display: flex; flex-direction: column; justify-content: left; flex; text-align: left;">
                    <label>Nome Completo</label>
                    <input placeholder="Nome Completo" id="nome_completo">
                    <label>Usuário</label>
                    <input type="text" placeholder="Crie um usuário" id="usuario">
                </div>

                <div style="display: flex; flex-direction: column; justify-content: left; flex; text-align: left;">
                    <label>Senha</label>
                    <input type="password" placeholder="Crie uma senha" id="senha">
                    <label>E-mail</label>
                    <input type="email" placeholder="E-mail" id="email">
                </div>

                <div style="display: flex; flex-direction: column; justify-content: center; flex; text-align: left;">
                    <label>Celular</label>
                    <input type="text" placeholder="Telefone" id="telefone">
                    <button onclick="acesso_cadastro()">Criar acesso</button>
                </div>
                <div style="display: flex; flex-direction: column; justify-content: space-between; align-items: center; flex; text-align: center;">
                    <label style="cursor: pointer;" onclick="alternar_telas('login')">&times;</label>                        
                </div>
            </div>
            
            `

    }

    if (tela == 'login') {

        conteudo = `

        <div id="acesso" style="display: flex; gap: 10px;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="display: flex; gap: 10px; justify-content: right; align-items: center;">
                    <label>Usuário</label>
                    <input type="text" placeholder="Usuário" id="usuario">
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                    <label>Senha</label>
                    <input type="password" placeholder="Senha" id="senha">
                </div>
                <button onclick="acesso_login()">Entrar</button>
            </div>
            <div style="display: flex; margin-left: 50px; justify-content: center; align-items: center;">

                <div style="display: flex; flex-direction: column; justify-content: left; align-items: center; padding: 10px;">
                    <label>Primeiro acesso?</label>
                    <button style="background-color: #097fe6;" onclick="alternar_telas('novo')">Cadastre-se</button>
                </div>
            </div>
        </div>    

        `

    }

    div_acesso.innerHTML = conteudo

}

function acesso_login() {

    document.getElementById('acesso').style.display = 'none'
    document.getElementById('loading').style.display = 'flex'

    let usuario = document.getElementById('usuario').value;
    let senha = document.getElementById('senha').value;

    let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=' + usuario + '*' + senha


    if (usuario == "" || senha == "") {

        openPopup_v2("Senha e/ou usuário não informado(s)")
        document.getElementById('acesso').style.display = 'flex'
        document.getElementById('loading').style.display = 'none'

    } else {

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                switch (true) {

                    case data == "Usuário não cadastrado":

                        openPopup_v2(data)
                        break

                    case data == "Senha incorreta":

                        openPopup_v2(data)
                        break

                    case data.acesso == "Autorizado":

                        localStorage.setItem('acesso', JSON.stringify(data))
                        window.location.href = '/htmls/inicial.html'
                        break

                    default:

                        openPopup_v2('Falha interna. Entre em contato com o planejamento.')

                }

                document.getElementById('acesso').style.display = 'flex'
                document.getElementById('loading').style.display = 'none'

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);

            });

    }

}

function acesso_cadastro() {

    document.getElementById('acesso').style.display = 'none'
    document.getElementById('loading').style.display = 'flex'

    let usuario = document.getElementById('usuario').value;
    let senha = document.getElementById('senha').value;
    let email = document.getElementById('email').value;
    let nome_completo = document.getElementById('nome_completo').value;
    let telefone = document.getElementById('telefone').value;


    let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=CAD*' + usuario + '*' + senha + '*' + email + '*' + nome_completo + '*' + telefone

    if (usuario == "" || senha == "" || email == "") {

        openPopup_v2("Senha, usuário ou e-mail não informado(s)")
        document.getElementById('acesso').style.display = 'flex'
        document.getElementById('loading').style.display = 'none'

    } else {

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                switch (true) {

                    case data == "Usuário já cadastrado":
                        openPopup_v2(data)
                        break

                    case data == "Cadastro realizado!":

                        localStorage.setItem('acesso', JSON.stringify({

                            acesso: "Autorizado",
                            email: email,
                            nome_completo: nome_completo,
                            permissao: 'user',
                            telefone: telefone,
                            usuario: usuario,
                            
                        }))

                        window.location.href = '/htmls/inicial.html'
                        break

                    default:

                        openPopup_v2('Falha interna. Entre em contato com o planejamento.', false)

                }

                document.getElementById('acesso').style.display = 'flex'
                document.getElementById('loading').style.display = 'none'

            })

            .catch(error => {

                console.error('Ocorreu um erro:', error);

            });
            
    }

}