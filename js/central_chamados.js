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

    const hora = new Date().getHours()
    const saudacao = hora > 18
        ? 'Boa noite'
        : hora > 12
            ? 'Boa tarde'
            : 'Bom dia'

    const modeloTabPendencias = ({ t1, t2, linhas }) => {

        const info = (titulo, valor) => valor
            ? `
                <div style="${vertical}; gap: 2px;">
                    <span><b>${titulo}:</b></span>
                    <div style="display: flex; flex-wrap: wrap;">${valor}</div>
                </div>
            `
            : ''

        const baloes = linhas
            .map(linha => {

                const {
                    nome,
                    chamado,
                    descricao,
                    usuario,
                    unidade,
                    dtCorrecaoFinal
                } = linha.correcao || {}

                const tipoCorrecaoFormatado = formatacaoTipoCorrecao(nome)
                const solicitado = usuario
                    ? `<span>Solicitado por ${usuario}</span>`
                    : ''

                return `
                <div class="balao-correcao" onclick="atalhoAuxiliar('${chamado}', 'chamados', 'includes')">
                    ${solicitado}
                    <div style="${horizontal}; padding: 1rem; gap: 1rem;">
                        <img src="imagens/alerta.png">
                        <div style="${vertical};">
                            ${tipoCorrecaoFormatado}
                            <span style="font-size: 1rem"><b>${chamado}</b></span>
                            ${info('Data Limite', dtCorrecaoFinal)}
                            ${info('Unidade', unidade)}
                            ${info('Descrição', descricao)}
                        </div>
                    </div>
                </div>
                `
            })
            .join('')

        return `
            <div class="b-atalhos">
                <div style="${horizontal}; gap: 1rem;">
                    <span class="titul-1" style="font-size: 25px;">${linhas.length}</span>
                    <span class="titul-1">${t1}</span>
                    <span class="tag-pendencias">${t2}</span>
                </div>
                <div style="overflow: hidden; border-radius: 5px;">
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
