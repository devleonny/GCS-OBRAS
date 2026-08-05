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

async function criarElementosIniciais() {

    const { setor, permissao, usuario } = acesso || {}

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
        { op: '!=', value: 'SOLUCIONADA' },
        { op: '!=', value: 'CANCELADO' }
    ]

    const tecOuCliente = ['técnico', 'cliente'].includes(permissao)

    const [tSetor, tAtrasados, tCorrecoes, tPermissao] = await Promise.all([

        (!setor || tecOuCliente)
            ? null
            : modTab({
                base: 'dados_ocorrencias',
                pag: 'tSetor',
                body: 'tSetor',
                explode: { path: 'snapshots.ultimaCorrecao' },
                filtros: {
                    'snapshots.ultimaCorrecao.*.nome': filtrosTipoCorrecao,
                    'snapshots.ultimaCorrecao.*.setor': { op: 'includes', value: setor }
                },
                criarLinha: 'linCorrecoes'
            }),

        permissao == 'técnico'
            ? null
            : modTab({
                base: 'dados_ocorrencias',
                pag: 'tAtrasados',
                body: 'tAtrasados',
                explode: { path: 'snapshots.ultimaCorrecao' },
                filtros: {
                    'snapshots.ultimaCorrecao.*.usuario': { op: 'includes', value: usuario },
                    'snapshots.ultimaCorrecao.*.nome': filtrosTipoCorrecao,
                    'snapshots.ultimaCorrecao.*.dtCorrecao': { op: '<d', value: new Date().toLocaleDateString() }
                },
                criarLinha: 'linCorrecoes'
            }),

        modTab({
            base: 'dados_ocorrencias',
            pag: 'tCorrecoes',
            body: 'tCorrecoes',
            explode: { path: 'snapshots.ultimaCorrecao' },
            filtros: {
                'snapshots.ultimaCorrecao.*.executor': { op: 'includes', value: usuario },
                'snapshots.ultimaCorrecao.*.nome': filtrosTipoCorrecao
            },
            criarLinha: 'linCorrecoes'
        }),

        (!permissao || tecOuCliente)
            ? null
            : modTab({
                base: 'dados_ocorrencias',
                pag: 'tPermissao',
                body: 'tPermissao',
                explode: { path: 'snapshots.ultimaCorrecao' },
                filtros: {
                    'snapshots.ultimaCorrecao.*.nome': filtrosTipoCorrecao,
                    'snapshots.ultimaCorrecao.*.permissao': { op: 'includes', value: permissao }
                },
                criarLinha: 'linCorrecoes'
            })
    ])

    const esquemaTabelas = [
        {
            t1: 'Agendamento atrasado:',
            t2: 'Reagendar',
            tabela: tAtrasados
        },
        {
            t1: 'Correções por Permissão:',
            t2: permissao,
            tabela: tPermissao
        },
        {
            t1: 'Correções por setor:',
            t2: setor,
            tabela: tSetor
        },
        {
            t1: 'Correções para:',
            t2: usuario,
            tabela: tCorrecoes
        },
    ]

    const modeloTabPendencias = ({ t1, t2, tabela }) => {

        if (!tabela)
            return ''

        return `
            <div class="b-atalhos">
                <div style="${horizontal}; gap: 1rem;">
                    <span class="titul-1">${t1}</span>
                    <span class="tag-pendencias">${t2}</span>
                </div>
                ${tabela}
            </div>
        `
    }

    const todasAsTabelas = esquemaTabelas
        .map(esq => {
            return modeloTabPendencias(esq)
        })
        .join('')

    pFundo.innerHTML = `    
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/BG.png" style="width: 10rem;">
            <span style="padding: 1rem; font-size: 1rem; color: white;">
                <b>${saudacao}</b>,<br> Logo abaixo veja alguns atalhos para ocorrências que precisam de atenção:
            </span>
        </div>

        <div class="b-painel">

            ${todasAsTabelas}

        </div>`

    const emMassa = ['tSetor', 'tAtrasados', 'tCorrecoes', 'tPermissao']
        .map(async (pag) => await paginacao(pag))

    await Promise.all(emMassa)

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
        'snapshots.contrato': { op: 'includes', value: id }
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
