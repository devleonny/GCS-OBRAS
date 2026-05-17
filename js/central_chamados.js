const modeloCampos = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: start; gap: 5px;">
        <label><b>${valor1}:</b></label>
        <div style="text-align: justify;">${elemento}</div>
    </div>`

const botaoImg = (img, funcao) => `
    <div class="botaoImg">
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

async function capturarLocalizacao() {
    return new Promise(resolve => {

        navigator.geolocation.getCurrentPosition(
            pos => {
                resolve({
                    ok: true,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                })
            },
            err => {
                resolve({
                    ok: false,
                    mensagem: 'Permissão recusada pelo usuário, para prosseguir libere a permissão.'
                })
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0
            }
        )
    })
}


async function criarElementosIniciais() {
    const pFundo = document.querySelector('.planoFundo')
    if (!pFundo)
        return

    const hora = new Date().getHours()
    const saudacao = hora > 18
        ? 'Boa noite'
        : hora > 12
            ? 'Boa tarde'
            : 'Bom dia'

    const filtrosTipoCorrecao = [
        { op: '!=', value: 'WRuo2' },
        { op: '!=', value: '4sGzb' }
    ]

    const filtroCliente = acesso.permissao == 'cliente'
        ? { 'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa } }
        : {}

    const [tAtrasados, tCorrecoes, contadoresMeus] = await Promise.all([
        modTab({
            base: 'dados_ocorrencias',
            pag: 'tAtrasados',
            body: 'tAtrasados',
            filtros: {
                'snapshots.ultimoSolicitante': { op: '=', value: acesso.usuario },
                'correcoes.*.tipoCorrecao': filtrosTipoCorrecao,
                'snapshots.dtCorrecao': { op: '<d', value: new Date().toLocaleDateString() },
                ...filtroCliente
            },
            criarLinha: 'linCorrecoes'
        }),

        modTab({
            base: 'dados_ocorrencias',
            pag: 'tCorrecoes',
            body: 'tCorrecoes',
            filtros: {
                'snapshots.ultimoExecutor.*.executor': { op: '=', value: acesso.usuario },
                'correcoes.*.tipoCorrecao': filtrosTipoCorrecao,
                ...filtroCliente
            },
            criarLinha: 'linCorrecoes'
        }),

        contarPorCampo({
            base: 'dados_ocorrencias',
            path: 'snapshots.ultimaCorrecao',
            filtros: {
                'correcoes.*.tipoCorrecao': filtrosTipoCorrecao,
                'usuario': { op: '=', value: acesso.usuario }
            }
        })
    ])

    const baloesMeus = Object.entries(contadoresMeus)
        .filter(([st]) => st !== 'todos' && st !== 'Solucionada')
        .map(([status, total]) => {
            return `
                <div class="pill" onclick="filtrarMinhasOcorrencias('${status}')">
                    <span class="pill-a" style="background: #b12425;">${total}</span>
                    <span class="pill-b">${status}</span>
                </div>`
        })
        .join('')

    const ocorrenciasAbertas = acesso.permissao == 'técnico'
        ? ''
        : `
            <div class="b-atalhos">
                <span class="titul-1">Minhas ocorrências abertas</span>
                ${baloesMeus || `<div style="${horizontal}; color: white; gap: 3px;"><span>Tudo certo por aqui</span> <img src="imagens/concluido.png"></div>`}
            </div>
            <div class="b-atalhos">
                <span class="titul-1">Atrasadas: <b>Verifique ou Reagende</b></span>
                ${tAtrasados}
            </div>
        `

    pFundo.innerHTML = `    
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/BG.png" style="width: 10rem;">
            <span style="padding: 1rem; font-size: 1rem; color: white;">
                <b>${saudacao}</b>,<br> Logo abaixo veja alguns atalhos para ocorrências que precisam de atenção:
            </span>
        </div>

        <div class="b-painel">
            ${ocorrenciasAbertas}

            <div class="b-atalhos">
                <span class="titul-1">Correções <b>para você</b></span>
                ${tCorrecoes}
            </div>
        </div>`

    await paginacao()
}


async function filtrarMinhasOcorrencias(st) {

    await telaOcorrencias()

    alternarFiltroDropdown('snapshots.ultimaCorrecao', st, true)
    alternarFiltroDropdown('usuario', acesso.usuario, true)

}

async function linCorrecoes(ocorrencia) {

    const { id, snapshots, correcoes } = ocorrencia || {}
    const { cliente, sistema, prioridade } = snapshots || {}
    const { descricao, usuario, executor, dtCorrecao } = correcoes[snapshots.ultimaCorrecaoId] || {}

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
                            <span style="font-size: 1rem;"><b>${id}</b></span>
                            <span><b>Status Correção:</b> ${snapshots?.ultimaCorrecao || ''}</span>
                            <span><b>Data Limite:</b> ${conversorData(dtCorrecao)}</span>
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
    controles.ocorrencias.filtros ??= {}
    controles.ocorrencias.filtros['snapshots.contrato'] = { op: 'includes', value: id }

    await telaOcorrencias()

}

function mostrarPendencias() {
    const p = document.querySelector('.painel-pendencias')
    const visivel = p.style.display

    p.style.display = (visivel === 'none' || visivel === '')
        ? 'flex'
        : 'none'
}
