    // ACESSO ;

    var div_acesso = document.getElementById('acesso')

    document.getElementById('senha').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            acesso_login()
            event.preventDefault();
        }
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

    function cadastrar() {

        let conteudo = `
            <div style="display: flex; column; gap: 10px; padding: 2vw;">

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

            </div>`

        openPopup_v2(conteudo, 'Cadastro')

    }

    function acesso_login() {
        document.getElementById('acesso').style.display = 'none'
        document.getElementById('loading').style.display = 'flex'

        var usuario = document.getElementById('usuario').value;
        var senha = document.getElementById('senha').value;

        let url = 'https://leonny.dev.br/login'

        if (usuario == "" || senha == "") {
            openPopup_v2("Senha e/ou usuário não informado(s)")
            document.getElementById('acesso').style.display = 'flex'
            document.getElementById('loading').style.display = 'none'

        } else {

            let payload = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, senha })
            }

            fetch(url, payload)

                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw err; });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Resposta do servidor:', data); // Debug

                    switch (true) {
                        case data.erro === "Usuário incorreto":
                        case data.erro === "Senha incorreta":
                            openPopup_v2(data.erro);
                            break;
                        case data.acesso === "Autorizado":
                            localStorage.setItem('acesso', JSON.stringify(data));
                            window.location.href = 'inicial.html';
                            break;
                        default:
                            openPopup_v2('Servidor Offline... fale com o Setor de Programação.');
                    }

                    document.getElementById('acesso').style.display = 'flex';
                    document.getElementById('loading').style.display = 'none';

                })
                .catch(error => {
                    console.error('Erro na requisição:', error);
                    openPopup_v2(error.erro || 'Erro desconhecido');

                    document.getElementById('acesso').style.display = 'flex';
                    document.getElementById('loading').style.display = 'none';
                });

        }
    }

    // NOVO USUÁRIO ; 

    function acesso_cadastro() {
        document.getElementById('acesso').style.display = 'none'
        document.getElementById('loading').style.display = 'flex'

        var usuario = document.getElementById('usuario').value;
        var senha = document.getElementById('senha').value;
        var email = document.getElementById('email').value;
        var nome_completo = document.getElementById('nome_completo').value;
        var telefone = document.getElementById('telefone').value;

        let url = 'https://leonny.dev.br/novo_usuario'

        if (usuario == "" || senha == "" || email == "") {
            openPopup_v2("Senha, usuário ou e-mail não informado(s)")
            document.getElementById('acesso').style.display = 'flex'
            document.getElementById('loading').style.display = 'none'
        } else {

            let payload = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usuario, senha, email, nome_completo, telefone })
            }

            fetch(url, payload)
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => { throw err; });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Resposta do servidor:', data); // Debug

                    switch (true) {
                        case data.erro === "Usuário já cadastrado":
                            openPopup_v2(data.erro);
                            break;
                        case data.acesso === "Autorizado":
                            localStorage.setItem('acesso', JSON.stringify(data));
                            window.location.href = 'inicial.html';
                            break;
                        default:
                            openPopup_v2('Servidor Offline... fale com o Setor de Programação.');
                    }

                    document.getElementById('acesso').style.display = 'flex';
                    document.getElementById('loading').style.display = 'none';

                })
                .catch(error => {
                    console.error('Erro na requisição:', error);
                    openPopup_v2(error.erro || 'Erro desconhecido');

                    document.getElementById('acesso').style.display = 'flex';
                    document.getElementById('loading').style.display = 'none';
                });

        }

    }