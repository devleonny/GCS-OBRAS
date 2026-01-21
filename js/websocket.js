let socket;
let reconnectInterval = 30000;
let emAtualizacao = false
let priExeGCS = true
let priExeOcorr = true

connectWebSocket()

function connectWebSocket() {

    socket = new WebSocket(`${api}:8443`)

    socket.onopen = async () => {
        msgStatus('Online', 1)
        await validarAcesso()
        await comunicacao()
    }

}

async function validarAcesso() {

    acesso = JSON.parse(localStorage.getItem('acesso'))
    msgStatus('Validando acesso...')
    if (acesso) {
        msg({ tipo: 'validar', usuario: acesso.usuario })
    } else {
        telaLogin()
    }

}

function msg(dados) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(dados))
    }
}

function msgStatus(msg, s = 2) {

    const simbolos = {
        1: '🟢🟢🟢',
        2: '🟠🟠🟠',
        3: '🔴🔴🔴'
    }

    msg = `${simbolos[s]} ${msg} ${new Date().toLocaleString()}`

    const divMensagem = document.querySelector('.div-mensagem')
    if (divMensagem) divMensagem.insertAdjacentHTML('beforeend', `<span>${i}</span>`)
    console.log(msg)
}

async function refletir() {
    if (app !== 'GCS') return
    sOverlay = true
    await executar(funcaoTela)
    sOverlay = false
}

async function comunicacao() {

    app = localStorage.getItem('app') || 'OCORRÊNCIAS'

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data)

        if (data.desconectar) {
            acesso = {}
            localStorage.removeItem('acesso')
            await resetarTudo()
            await telaLogin()
            popup({ mensagem: 'Usuário removido do servidor' })
            return
        }

        if (data.validado) {

            // Sempre que atualizar a página será verificado o acesso;

            // Se não existir mudanças no acesso;

            msgStatus('Online', 1)

            if (data.validado == 'Sim') {


                if (app == 'GCS') {

                    if (priExeGCS) {
                        await telaInicial()
                        priExeGCS = false
                    }

                } else {

                    // Seguir este fluxo apenas em Ocorrências;
                    await telaPrincipal()
                    await atualizarOcorrencias()

                    // Recuperar Filtros;
                    filtrosAtivos = JSON.parse(localStorage.getItem('filtrosAtivos')) || {}
                }

            } else {

                // Se existirem mudanças, um reset será feito apenas em Ocorrências;

                if (app == 'GCS') {
                    await telaInicial()

                } else {

                    msgStatus('Offline', 3)
                    msgStatus('Alteração no acesso recebida...')
                    await resetarTudo()
                    await atualizarOcorrencias()
                    msg({ tipo: 'confirmado', usuario: acesso.usuario })
                    msgStatus('Tudo certo', 1)

                }
            }
        }

        // Se a base não pertencer ao app, retornar;
        if (app == 'OCORRÊNCIAS') return

        if (app == 'GCS' && data.tabela == 'dados_orcamentos') {
            verificarPendencias()
        }

        if (data.tipo == 'exclusao') { // Só se for no nível;
            await deletarDB(data.tabela, data.id)
            await refletir()
        }

        if (data.tipo == 'atualizacao') {
            await inserirDados({ [data.id]: data.dados }, data.tabela)
            await refletir()
        }

        if (data.tipo == 'status') {
            const user = await recuperarDado('dados_setores', data.usuario)

            if (user) {
                user.status = data.status
                await inserirDados({ [data.usuario]: user }, 'dados_setores')
            }

            await usuariosToolbar()
            balaoUsuario(data.status, data.usuario)
        }

    }

    socket.onclose = () => {
        msgStatus('Servidor offline', 3)
        setTimeout(connectWebSocket, reconnectInterval)
    }

}

async function identificacaoUser() {

    dados_setores = await sincronizarDados({ base: 'dados_setores' })
    acesso = dados_setores[acesso.usuario]

    const bloq = ['cliente', 'técnico', 'visitante']
    if ((acesso && bloq.includes(acesso.permissao)) || !acesso)
        return telaPrincipal()

    if (app == 'OCORRÊNCIAS') return
    if (document.title == 'Política de Privacidade') return
    if (!acesso || !acesso.permissao || acesso.permissao == 'novo') {
        localStorage.removeItem('acesso')
        return telaLogin()
    }

    if (priExeGCS) await telaInicial()

}

async function carregarControles() {

    cUsuario.style.display = ''
    const modelo = (imagem, funcao, idElemento) => {
        return `
        <div onclick="${funcao}" style="${vertical};">
            <img src="imagens/${imagem}.png">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    const permitidosAprovacoes = ['adm', 'diretoria']
    const permitidosProdutos = ['LOGÍSTICA', 'SUPORTE', 'FINANCEIRO']
    const barraStatus = `
            <div id="divUsuarios"></div>

            ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
            ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}
            ${permitidosProdutos.includes(acesso.setor) ? modelo('preco', 'precosDesatualizados()', 'contadorProdutos') : ''}

            <img title="Abrir mais 1 aba" src="imagens/aba.png" onclick="maisAba()">
        `
    const cabecalhoUsuario = document.querySelector('.cabecalho-usuario')
    if (cabecalhoUsuario) cabecalhoUsuario.innerHTML = barraStatus

    await usuariosToolbar()
    await precosDesatualizados(true) //Atualiza apenas a quantidade;
    await verificarPendencias() // Pendencias de aprovação;
}