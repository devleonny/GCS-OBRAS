function telaInicial() {

    document.querySelector('[name="titulo"]').textContent = 'GCS'

    const autorizadosPainelNotas = (acesso) => {
        const liberados = {
            permissao: ['adm', 'diretoria', 'fin'],
            usuario: ['Tayna', 'Livia'],
            setor: ['FINANCEIRO']
        }

        return (
            liberados.permissao.includes(acesso.permissao) ||
            liberados.usuario.includes(acesso.usuario) ||
            liberados.setor.includes(acesso.setor)
        );
    }

    const hora = new Date().getHours()
    const boasVindas = hora > 12 ? 'Boa tarde' : hora > 18 ? 'Boa noite' : 'Bom dia'

    const acumulado = `
        <div class="planoFundo">
            <div class="infos">
                <span><b>${boasVindas}</b>,</span>
                <span>Todos os botões estão no menu do canto <b>☰</b>,</span>
                <span>Caso precisem recarregar a tela usem o <b>F5</b>,</span>
                <span>Se as tabelas estiverem estranhamente desatualizadas, usem o <b>F8</b>,</span>
                <div style="${horizontal}; gap: 5px;">
                    <img src="gifs/novo.gif" style="width: 5rem;">
                    Cadastro de Clientes agora pelo GCS na tela de <b>Pagamentos, Orçamentos e Chamados</b>.
                </div>
            </div>
        </div>
    `
    tela.innerHTML = acumulado

    criarMenus('inicial')

}

async function origemDados(toggle, inicial) {

    overlayAguarde()
    origem = toggle.checked ? 'novos' : 'antigos'
    const track = document.querySelector('.track')
    const thumb = document.querySelector('.thumb')

    sessionStorage.setItem('origem', origem)

    if (!track) return

    if (origem == 'novos') {
        toggle.checked = true
        document.body.style.background = 'linear-gradient(45deg, #249f41, #151749)'
        track.style.backgroundColor = "#4caf50"
        thumb.style.transform = "translateX(0)"
    } else {
        toggle.checked = false
        document.body.style.background = 'linear-gradient(45deg, #B12425, #151749)'
        track.style.backgroundColor = "#B12425"
        thumb.style.transform = "translateX(26px)"
    }

    if (!inicial) {
        if (telaAtiva == 'orcamentos') {
            await telaOrcamentos()
        }

        if (telaAtiva == 'composicoes') {
            await telaComposicoes(true)
        }

        if (telaAtiva == 'criarOrcamentos') {
            await criarOrcamento()
        }

        if (telaAtiva == 'criarOrcamentosAluguel') {
            await criarOrcamentoAluguel()
        }
    }

    removerOverlay()

}

function interruptorCliente(mostrar) {

    origem = sessionStorage.getItem('origem') || 'novos'
    const interruptor = document.querySelector('.interruptor')

    if (!mostrar) return interruptor.innerHTML = ''

    const acumulado = `
        <div id="interruptorOrigem" class="gatilhos-interruptor">
            <span>Clientes novos</span>

            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">

                <input onchange="origemDados(this);" type="checkbox" id="toggle" style="opacity:0; width:0; height:0;" ${origem == 'novos' ? 'checked' : ''}>
                
                <span class="track"></span>
                <span class="thumb"></span>

            </label>

            <span>Antigos</span>
        </div>
    `
    const gatilhos = document.getElementById('interruptorOrigem')
    if (!gatilhos) interruptor.innerHTML = acumulado

    origemDados({ checked: origem == 'novos' }, inicial = true)

}

async function filtrarArquivados(remover) {
    const tagArquivado = document.querySelector('[name="tagArquivado"]')
    if (remover) {
        naoArquivados = true
    } else {
        naoArquivados = naoArquivados ? false : true
    }

    if (!naoArquivados) {
        const balao = `
        <div name="tagArquivado" class="tag">
            <img style="width: 2vw;" src="imagens/desarquivar.png">
            <span>Arquivados</span>
            <img style="width: 1.5vw;" src="imagens/cancel.png" onclick="filtrarArquivados(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagArquivado.remove()
    }

    await telaOrcamentos()
}

async function filtrarMeus(remover) {
    const tagMeus = document.querySelector('[name="tagMeus"]')
    if (remover) {
        meusOrcamentos = true
    } else {
        meusOrcamentos = meusOrcamentos ? false : true
    }

    if (!meusOrcamentos) {
        const balao = `
        <div name="tagMeus" class="tag">
            <img style="width: 2vw;" src="imagens/painelcustos.png">
            <span>Meus orcaçamentos</span>
            <img style="width: 1.5vw;" src="imagens/cancel.png" onclick="filtrarMeus(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagMeus.remove()
    }

    await telaOrcamentos()
}

