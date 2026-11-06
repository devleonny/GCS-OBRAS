const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}:</b></label>
        <div style="text-align: justify;">${elemento}</div>
    </div>`

const btnImagem = (img, funcao) => `
    <div class="botao-imagem-ocorrencias">
        <img src="imagens/${img}.png" onclick="${funcao}">
    </div>`

const btnRodape = (texto, funcao) => `
    <button class="btnRodape" onclick="${funcao}">${texto}</button>
`
const btnPadrao = (texto, funcao) => `
    <span class="btnPadrao" onclick="${funcao}">${texto}</span>
`
const btn = ({ img, nome, funcao, id, elemento }) => `
    <div class="botao-lateral" ${id ? `id="${id}"` : ''} onclick="${funcao}">
        ${img ? `<img src="imagens/${img}.png">` : ''}
        ${elemento || ''}
        <div>${nome}</div>
    </div>
`

function solicitarPermissoes() {
    return new Promise((resolve, reject) => {
        if (!(cordova.plugins && cordova.plugins.permissions)) {
            popup({ mensagem: 'Plugin de permissões não está disponível. Algumas funcionalidades podem não funcionar.' })
            return resolve();
        }

        const permissions = cordova.plugins.permissions;
        const androidVersion = (device && device.version) || '0';
        const lista = [
            permissions.CAMERA,
            permissions.ACCESS_FINE_LOCATION,
            permissions.ACCESS_COARSE_LOCATION,
            permissions.FOREGROUND_SERVICE,
            permissions.FOREGROUND_SERVICE_LOCATION,
            ...(cordova.platformId === 'android' && parseFloat(androidVersion) >= 13
                ? [permissions.POST_NOTIFICATIONS]
                : [])
        ];

        permissions.requestPermissions(lista, (status) => {
            if (!status || typeof status.hasPermission === 'undefined') {
                popup({ mensagem: `Falha ao verificar permissões. Verifique as configurações do dispositivo.` })
                return reject(new Error('Verificação de permissões falhou'));
            }

            resolve();
        }, (error) => {
            popup({ mensagem: `Erro ao solicitar permissões: ${error}`, titulo: 'Erro' })
            reject(error);
        });
    });
}

function exibirSenha(img) {

    const inputSenha = img.previousElementSibling
    const atual = inputSenha.type == 'password'
    inputSenha.type = atual ? 'text' : 'password'
    img.src = `imagens/${atual ? 'olhoAberto' : 'olhoFechado'}.png`

}

async function criarElementosIniciais() {

    const pFundo = document.querySelector('.planoFundo')

    if (!pFundo)
        return

    const hora = dataServidor().getHours()
    const saudacao = hora > 18
        ? 'Boa noite'
        : hora > 12
            ? 'Boa tarde'
            : 'Bom dia'

    // Um só modelo de balão para todos os blocos; muda só o título, os campos e o clique.
    // tipo 'colaboradores': ferramentas e materiais (js/colaboradores.js), abre a ficha do colaborador.
    // tipo 'documentos': documentos do próprio usuário vencendo/vencidos (abre a lista dele).
    // tipo 'precos': preços a confirmar, um cartão por LPU (abre o painel de preços).
    // Documentos do RH (adm e fin): um cartão por funcionário com vencidos e obrigatórios faltando.
    const cartaoDocumento = ({ funcionario, nome, cargo, vencidos = [], faltantes = [] }) => `
        <div class="pendencia-card" onclick="abrirDocumentosAVencer('${escaparAtributo(funcionario)}')">
            <div class="pendencia-card-topo">
                ${vencidos.length ? '<span class="documento-situacao vencido">VENCIDO</span>' : ''}
                ${faltantes.length ? '<span class="documento-situacao vence">FALTANDO</span>' : ''}
            </div>
            <b class="pendencia-card-titulo">${escaparAtributo(nome || 'Sem nome')}</b>
            <div class="pendencia-card-campos">
                ${cargo ? `<span><small>Cargo</small>${escaparAtributo(cargo)}</span>` : ''}
                ${vencidos.length ? `<span><small>Vencidos</small>${vencidos.map(v => escaparAtributo(v.doc)).join(', ')}</span>` : ''}
                ${faltantes.length ? `<span><small>Faltam</small>${faltantes.map(d => escaparAtributo(d)).join(', ')}</span>` : ''}
            </div>
        </div>`

    const cartaoPrecos = ({ lpu, quantidade, maisAntigo }) => `
        <div class="pendencia-card" onclick="abrirPrecosVencidos('${escaparAtributo(lpu)}')">
            <div class="pendencia-card-topo">
                <span class="documento-situacao vence">CONFIRMAR PREÇOS</span>
            </div>
            <b class="pendencia-card-titulo">${escaparAtributo(String(lpu).toUpperCase())}</b>
            <div class="pendencia-card-campos">
                <span><small>Itens</small>${quantidade}</span>
                <span><small>Mais antigo</small>${maisAntigo ? `${maisAntigo} dias` : 'sem data'}</span>
            </div>
        </div>`

    const modeloTabPendencias = ({ tipo, t1, t2, linhas }) => {

        const baloes = linhas
            .map(linha => {

                if (tipo == 'documentos') return cartaoDocumento(linha)
                if (tipo == 'precos') return cartaoPrecos(linha)

                const {
                    nome,
                    chamado,
                    descricao,
                    usuario,
                    unidade,
                    dtCorrecaoFinal,
                    movimento
                } = linha.correcao || {}

                const colaborador = tipo == 'colaboradores'

                const clique = colaborador
                    ? `irParaColaborador('${escaparAtributo(linha.colaborador)}', '${escaparAtributo(linha.requisicao || '')}')`
                    : `atalhoAuxiliar('${chamado}', 'chamados', 'includes')`

                const titulo = colaborador ? unidade || 'Sem cadastro' : chamado

                const campos = (colaborador
                    ? [['Movimento', movimento == 'DEVOLUÇÃO' ? 'Devolução' : 'Saída']]
                    : [['Data limite', dtCorrecaoFinal], ['Unidade', unidade]])
                    .filter(([, valor]) => valor)
                    .map(([rotulo, valor]) => `<span><small>${rotulo}</small>${escaparAtributo(valor)}</span>`)
                    .join('')

                return `
                <div class="pendencia-card" onclick="${clique}">
                    <div class="pendencia-card-topo">
                        ${formatacaoTipoCorrecao(nome)}
                        ${usuario ? `<small>por ${escaparAtributo(usuario)}</small>` : ''}
                    </div>
                    <b class="pendencia-card-titulo">${escaparAtributo(titulo || '')}</b>
                    ${campos ? `<div class="pendencia-card-campos">${campos}</div>` : ''}
                    ${descricao ? `<p class="pendencia-card-descricao">${escaparAtributo(descricao)}</p>` : ''}
                </div>
                `
            })
            .join('')

        return `
            <div class="b-atalhos">
                <div class="cabecalho-pendencias" style="${horizontal}; gap: 1rem;">
                    <span class="titul-1" style="font-size: 25px;">${tipo == 'precos' ? linhas.reduce((soma, l) => soma + (l.quantidade || 0), 0) : linhas.length}</span>
                    <span class="titul-1">${t1}</span>
                    <span class="tag-pendencias">${t2}</span>
                </div>
                <div class="contorno-pendencias">
                    <div class="bloco-pendencias">${baloes}</div>
                </div>
            </div>
        `
    }

    const { dados, timestamp } = await dadosIniciais()

    const blocos = (dados || [])
        .filter(dados => dados?.linhas.length)
        .map(dados => modeloTabPendencias(dados))
        .join('')

    const jogo = `<canvas id="jogoPendencias" width="620" height="180"></canvas>`

    const mensagem = blocos 
        ? `Logo abaixo veja alguns atalhos para ocorrências que precisam de atenção:`
        : 'Não existem pendências para você!'

    pFundo.innerHTML = `
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/BG.png" style="width: 10rem;">
            <span style="padding: 1rem; font-size: 1rem; color: white;">
                <b>${saudacao}</b>,<br> ${mensagem}
            </span>
        </div>

        <div class="b-painel">

            ${blocos || jogo}

        </div>`

    if(!blocos)
        await atribuirFuncoesJogo()

    // Popup de aniversariantes do dia (uma vez por dia; não espera para não travar a tela).
    if (typeof verificarAniversarios === 'function')
        verificarAniversarios()

}

async function filtrarMinhasOcorrencias(st) {

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros = {
        'usuario': {
            modo: 'OR',
            origem: 'dropdown',
            regras: [
                {
                    op: '=',
                    value: acesso.usuario
                }
            ]
        },
        'snapshots.ultimaCorrecao.*.nome': {
            modo: 'OR',
            origem: 'dropdown',
            regras: [
                {
                    op: '=',
                    value: st == 'EM BRANCO' ? '' : st
                }
            ]
        }

    }

    await telaOcorrencias()

}

async function linCorrecoes(ocorrencia) {

    const { id, snapshots, correcoes, nome, dtCorrecao, idCorrecao } = ocorrencia || {} // Explode
    const { cliente, sistema, prioridade } = snapshots || {}
    const { descricao, usuario, executor } = correcoes?.[idCorrecao] || {}

    const listaExecutores = Array.isArray(executor)
        ? executor.join(', ')
        : executor

    const titulo = executor
        ? ` para <b>${listaExecutores}</b>`
        : ', sem executor definido'

    return `
        <tr>
            <td>
                <div class="balao-correcao"
                    onclick="minhaCorrecao('${id}')">
                    <span>Solicitado por <b>${usuario || 'Desconhecido'}</b>${titulo}</span>
                    <div style="${horizontal}; gap: 1rem;">

                        <img src="imagens/alerta.png">

                        <div style="${vertical}">
                            ${formatacaoTipoCorrecao(nome)}
                            <span style="font-size: 1rem;"><b>${id}</b></span>                       
                            <span><b>Data Limite:</b> ${dtCorrecao || ''}</span>
                            <span><b>Unidade:</b> ${cliente?.nome || ''}</span>
                            <span><b>Sistema:</b> ${sistema}</span>
                            <span><b>Prioridade:</b> ${prioridade}</span>
                            <span><b>Descrição:</b> ${descricao || ''}</span>
                        </div>
                    </div>
                </div>
            </td>
        </tr>`

}

async function minhaCorrecao(id) {

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros = {
        'chamados': { op: 'includes', value: id }
    }

    await telaOcorrencias()

}

function mostrarPendencias() {
    const p = document.querySelector('.painel-pendencias')
    const visivel = p.style.display

    p.style.display = (visivel === 'none' || visivel === '')
        ? 'flex'
        : 'none'
}
