let acesso = JSON.parse(localStorage.getItem('acesso'))
let dados_setores = {}
let filtrosUsuarios = {}
let logo = 'https://i.imgur.com/Nb8sPs0.png'
let esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}
const itensImportados = [
    'gcs-725', 'gcs-726', 'gcs-738', 'gcs-739', 'gcs-734', 'gcs-740', 'gcs-741', 'gcs-730', 'gcs-742', 'gcs-743', 'gcs-744', 'gcs-747', 'gcs-729', 'gcs-728', 'gcs-727', 'gcs-1135', 'gcs-1136', 'gcs-1137'
]

document.addEventListener('keydown', function (event) {
    if (event.key === 'F5') f5()
    if (event.key === 'F2') openPopup_v2(new Date().getTime(), 'TIMESTAMP', true)
})

function f5() {
    location.reload();
}

identificacaoUser()

function ativarCloneGCS(ativar) {

    localStorage.setItem('modoClone', ativar)
    carregarIcones()
    corFundo()

}

async function verificarAlertas() {

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    if (modoClone) return

    await sincronizarDados('alertasChamados', true)
    let alertasChamados = await recuperarDados('alertasChamados') || {}

    let contador = 0

    for (let [his, alerta] of Object.entries(alertasChamados)) {

        let respostas = alerta?.respostas || {}

        for (let [idMensagem, resposta] of Object.entries(respostas)) {
            if (
                (alerta.enviadoDe == acesso.usuario || alerta.destinado == acesso.usuario) // Precisam ser as pessoas envolvidas;
                && !resposta.lido // A mensagem precisa não ter sido lida;
                && resposta.usuario != acesso.usuario // E o usuário que recebe tem quer ser diferente do usuário que enviou;
            ) {
                contador++
            }
        }

    }

    let contadorMensagens = document.getElementById('contadorMensagens')
    if (contadorMensagens) {
        contadorMensagens.style.display = contador == 0 ? 'none' : 'flex'
        contadorMensagens.textContent = contador
    }

}

async function enviarMensagem(button, his) {

    overlayAguarde()

    let alertasChamados = await recuperarDados('alertasChamados') || {}
    let alerta = alertasChamados[his]
    let idMensagem = gerar_id_5_digitos()
    if (!alerta.respostas) {
        alerta.respostas = {}
    }

    let resposta = {
        usuario: acesso.usuario,
        data: data_atual('completa'),
        mensagem: button.previousElementSibling.value,
        lido: false
    }

    alerta.respostas[idMensagem] = resposta

    await enviar(`alertasChamados/${his}/respostas/${idMensagem}`, resposta)
    await inserirDados(alertasChamados, 'alertasChamados')
    await verificarAlertas()
    remover_popup()

    let divAlertas = document.getElementById('divAlertas')
    if (divAlertas) divAlertas.remove()
    await painelMensagens()

}

function carregarIcones() {

    if (document.title != 'Página Inicial') return

    let ativar = JSON.parse(localStorage.getItem('modoClone')) || false
    let painel_geral = document.getElementById('painel_geral')
    let permissoesLiberadas = ['adm', 'gerente', 'diretoria', 'editor', 'log']
    let setoresLiberados = ['LOGÍSTICA']
    let moduloComposicoes = (permissoesLiberadas.includes(acesso.permissao) || setoresLiberados.includes(acesso.setor))
    let registroHistorico = acesso.permissao == 'adm'
    let atalho = (termo, img, funcao) => {
        return `
            <div class="block" style="flex-direction: column;" onclick="${funcao}">
                <img src="imagens/${img}.png">
                <label>${termo}</label>
            </div>        
        `
    }

    let icones = `
        ${atalho('Orçamentos', 'projeto', `window.location.href='orcamentos.html'`)}

        ${moduloComposicoes
            ? atalho('Composições', 'composicoes', `window.location.href='composicoes.html'`)
            : ''}

        ${atalho('Chamados', 'chamados', `window.location.href='chamados.html'`)}
        ${atalho('Cotações', 'cotacao2', `window.location.href='cotacoes.html'`)}
        ${atalho('Estoque', 'estoque', `window.location.href='estoque.html'`)}
        ${atalho('Reembolsos & Pagamentos', 'reembolso', `window.location.href='pagamentos.html'`)}
        ${atalho('Painel Kanban', 'kanban', `window.location.href='projetos.html'`)}
        ${atalho('Agenda', 'agenda', `window.location.href='agenda.html'`)}
        
        ${registroHistorico
            ? atalho('Suporte', 'suporte', `window.location.href='tickets.html'`)
            : ''}
        
        ${registroHistorico
            ? atalho('Histórico de Alterações GCS', 'historico', `window.location.href='historicoRegistros.html'`)
            : ''}
    `

    if (ativar) {
        icones = `
        ${atalho('Orçamentos', 'projeto', `window.location.href='orcamentos.html'`)}

        ${moduloComposicoes
                ? atalho('Composições', 'composicoes', `window.location.href='composicoes.html'`)
                : ''}
         ${registroHistorico
                ? atalho('Histórico de Alterações GCS', 'historico', `window.location.href='historicoRegistros.html'`)
                : ''}
             `
    }

    painel_geral.innerHTML = icones
}

function corFundo() {
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false

    if (document.title !== 'PDF') {
        document.body.style.background = modoClone ? 'linear-gradient(45deg,rgb(36, 159, 65), #151749)' : 'linear-gradient(45deg,  #B12425, #151749)'
    }
}

async function identificacaoUser() {
    corFundo()

    if (document.title == 'Login') return
    if (!acesso) return window.location.href = 'login.html'

    await sincronizarSetores()
    acesso = dados_setores[acesso.usuario]
    localStorage.setItem('acesso', JSON.stringify(acesso))
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false

    carregarIcones() // ícones da tela inicial;
    verificarAlertas() // Verificar a quantidade de mensagens;
    verificarPendencias() // Pendencias de aprovação;

    let modelo = (imagem, funcao, idElemento) => {
        return `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <img src="imagens/${imagem}.png" style="width: 2vw; cursor: pointer;" onclick="${funcao}">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `

    }

    let permitidosAprovacoes = ['adm', 'coordenacao', 'diretoria']

    if (document.title !== 'PDF' && acesso.usuario) {

        let texto = `
            <div class="cabecalhoUsuario">
                <div class="botaoUsuarios" onclick="painelUsuarios(this)">
                    <img src="imagens/online.png">
                    <label>Online</label>
                </div>

                ${!modoClone ? modelo('mensagem', 'abrirMensagens(this)', 'contadorMensagens') : ''}
                ${modelo('aprovado', 'verAprovacoes()', 'contadorPendencias')}
                ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}

                <label onclick="deseja_sair()"
                style="cursor: pointer; color: white;">${acesso.usuario} • ${acesso.permissao} • ${acesso.setor} • Sair</label>
            </div>

        `
        document.body.insertAdjacentHTML('beforebegin', texto)
    }

}

async function sincronizarSetores() {

    dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
    let timestamps = []
    for ([usuario, objeto] of Object.entries(dados_setores)) {
        if (objeto.timestamp) {
            timestamps.push(objeto.timestamp)
        }
    }

    const maiorTimestamp = timestamps.length ? Math.max(...timestamps) : 0
    let nuvem = await lista_setores(maiorTimestamp)

    let dadosMesclados = {
        ...dados_setores,
        ...nuvem
    }

    dados_setores = dadosMesclados
    localStorage.setItem('dados_setores', JSON.stringify(dadosMesclados))

    return dadosMesclados

}

async function abrirMensagens(elementoOrigial) {
    let alertasChamados = await recuperarDados('alertasChamados') || {}
    let divAlertas = document.getElementById('divAlertas')
    if (divAlertas) return divAlertas.remove()

    let alertas = ''
    for (let [his, alerta] of Object.entries(alertasChamados)) {

        if (alerta.destinado == acesso.usuario || alerta.enviadoDe == acesso.usuario) {

            let mensagens = ''
            for ([idMensagem, resposta] of Object.entries(alerta?.respostas || {})) {

                let confirmacaoLeitura = ''
                if (resposta.usuario != acesso.usuario) {
                    confirmacaoLeitura = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <input type="checkbox" style="cursor: pointer;" onchange="marcarLido(this, '${his}', '${idMensagem}')" ${resposta.lido ? 'checked' : ''}>
                        <label>Lido</label>
                    </div>`
                } else {
                    confirmacaoLeitura = `<img src="imagens/${resposta.lido ? 'doublecheck' : 'naolido'}.png" style="width: 2vw;">`
                }

                mensagens += `
                    <div style="display: flex; justify-content: center; align-items: start; width: 100%;">
                        <span class="bordaWhatsapp"></span>
                        <div class="balaoWhatsapp">
                            <label><strong>${resposta.usuario}</strong> diz:</label>
                            <label>${resposta.mensagem}</label>

                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%;">
                                <label><strong>${resposta.data}</strong></label>
                                ${confirmacaoLeitura}
                            </div>
                        </div>
                    </div>
                `
            }

            mensagens += `
                <div style="width: 100%; display: flex; align-items: center; justify-content: start;">
                    <textarea placeholder="Digite uma mensagem"></textarea>
                    <button style="background-color: green;" onclick="enviarMensagem(this, '${his}')">Enviar</button>
                </div>
            `

            alertas += `
                <div class="contornoMensagem">

                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="irChamado('${alerta.manutencao}', '${his}')">
                        <label class="labelMensagem"><strong>Clique aqui</strong> [${alerta.chamado}]</label>
                    </div>
                    <br>
                    ${mensagens}
                </div>
                `
        }
    }

    let pos = elementoOrigial.getBoundingClientRect();

    if (alertas == '') alertas = `<hr style="width: 100%;"><label>Você não possui mensagens no momento</label>`

    let acumulado = `
    <div id="divAlertas" class="divOnline" style="background-color: #d2d2d2; left: ${pos.left + window.scrollX}px; top: ${pos.bottom + window.scrollY}px;">
        <label style="font-size: 1.2vw;">MENSAGENS</label>
        ${alertas}
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', acumulado)

}

async function irChamado(idChamado, idAlerta) {
    let mensagem = `
        <div style="display: flex; padding: 2vw; gap: 2vw; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>O chamado não existe mais...</label>
        </div>
    `
    let chamadoArmazenado = localStorage.getItem('irChamado')

    if (chamadoArmazenado) {
        chamadoArmazenado = JSON.parse(chamadoArmazenado)
        await sincronizarDados('dados_manutencao')
        let dados_manutencao = await recuperarDados('dados_manutencao') || {}
        if (dados_manutencao[chamadoArmazenado.idChamado]) {
            await abrir_manutencao(chamadoArmazenado.idChamado)
        } else {
            openPopup_v2(mensagem, 'AVISO')
        }
        localStorage.removeItem('irChamado')
        deletar(`alertasChamados/${chamadoArmazenado.idAlerta}`)
    } else if (idChamado) {
        localStorage.setItem('irChamado', JSON.stringify({ idChamado, idAlerta }))
        window.location.href = 'chamados.html'
    }

}

async function marcarLido(input, his, idMensagem) {

    let alertasChamados = await recuperarDados('alertasChamados') || {}

    let alerta = alertasChamados[his]
    alerta.respostas[idMensagem].lido = input.checked

    await inserirDados(alertasChamados, 'alertasChamados')
    await enviar(`alertasChamados/${his}/respostas/${idMensagem}/lido`, input.checked)
    await verificarAlertas()

}

async function configs() {

    overlayAguarde()

    let status = await servicos('livre')

    await sincronizarSetores()

    let linhas = ''
    let listas = {
        permissoes: ['', 'adm', 'user', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo'],
        setores: ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE']
    }

    dados_setores = Object.keys(dados_setores)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .reduce((obj, chave) => {
            obj[chave] = dados_setores[chave];
            return obj;
        }, {});

    for ([usuario, dados] of Object.entries(dados_setores)) {

        let opcoes_permissao = ''
        let opcoes_setores = ''

        listas.permissoes.forEach(permissao => {
            opcoes_permissao += `
            <option ${dados?.permissao == permissao ? 'selected' : ''}>${permissao}</option>
            `
        })

        listas.setores.forEach(setor => {
            opcoes_setores += `
            <option ${dados?.setor == setor ? 'selected' : ''}>${setor}</option>
            `
        })

        linhas += `
        <tr>
            <td style="text-align: left;">${usuario}</td>
            <td>
                <select class="opcoesSelect" onchange="alterar_usuario('permissao', '${usuario}', this)" style="cursor: pointer;">${opcoes_permissao}</select>
            </td>
            <td>
                <select class="opcoesSelect" onchange="alterar_usuario('setor', '${usuario}', this)" style="cursor: pointer;">${opcoes_setores}</select>
            </td>
        </tr>
        `
    }

    let ths = ''
    let tbusca = ''
    let cabecalhos = ['Usuário', 'Permissão', 'Setores']
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`
        tbusca += `
        <th style="background-color: white;">
            <div style="display: flex; align-items: center; justify-content: center;">
                <input oninput="pesquisar_generico(${i}, this.value, filtrosUsuarios, 'tbodyUsuarios')">
                <img src="imagens/pesquisar2.png" style="width: 1vw;">
            </div>
        </th>
        `
    })

    let tabela = `
    <table class="tabela" style="width: 30vw;">
        <thead>
            <tr>${ths}</tr>
            <tr>${tbusca}</tr>
        </thead>
        <tbody id="tbodyUsuarios">${linhas}</tbody>
    </table>
    `

    let acumulado = `
    <div style="display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 1vw;">
        <label>Ative ou Desative a função:</label>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <input type="checkbox" style="width: 25px; height: 25px;" onchange="servicos('livre', this.checked)" ${status ? 'checked' : ''}>
            <label>Modalidade Livre</label>
        </div>

        <hr style="width: 100%;">
        <label>Gestão de Usuários</label>
        ${tabela}
    </div>
    `
    remover_popup()
    openPopup_v2(acumulado, 'Configurações')

}

async function alterar_usuario(campo, usuario, select) {

    if (dados_setores[usuario]) {

        let alteracao = await configuracoes(usuario, campo, select.value) // Se alterar no servidor, altera localmente;
        if (alteracao.status) {
            dados_setores[usuario][campo] = select.value
        } else {
            select.value = dados_setores[usuario][campo] // Devolve a informação anterior pro elemento;
        }
    }
}

function verificar_timestamp_nome(nome) {
    let regex = /^(\d{13})\.\w+$/;
    let match = nome.match(regex);

    if (match) {
        let timestamp = parseInt(match[1]);
        let data = new Date(timestamp);
        return !isNaN(data.getTime()) && data.getFullYear() > 2000;
    }

    return false;
}

function abrirArquivo(link) {

    if (verificar_timestamp_nome(link)) { // Se for um link composto por timestamp, então vem do servidor;
        link = `https://leonny.dev.br/uploads/${link}`
    } else { // Antigo Google;
        link = `https://drive.google.com/file/d/${link}/view?usp=drivesdk`
    }

    try {
        shell.openExternal(link);
    } catch {
        window.open(link, '_blank');
    }
}

function deseja_sair() {
    openPopup_v2(`
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2vw;">
            <label>Deseja Sair?</label>
            <button onclick="sair()" style="background-color: green">Sim</button>
        </div>
        `, 'Aviso')
}

function inicial_maiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''

    if (string.includes('lpu')) return string.toUpperCase()
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function removerOverlay() {
    let aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()
}

function overlayAguarde() {

    let aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()

    let elemento = `
    <div id="aguarde" style="display: flex; 
                align-items: center; 
                justify-content: center; 
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10005;
                font-size: 1.5em;
                border-radius: 3px;
            ">
        <img src="gifs/loading.gif" style="width: 5vw;">
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', elemento)

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    document.getElementById('aguarde').style.height = `${pageHeight}px`;

}

setInterval(async function () {
    await reprocessar_offline()
}, 60000)

async function reprocessar_offline() {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};

    for (let operacao in dados_offline) {
        let operacoes = dados_offline[operacao];

        for (let id in operacoes) {
            let evento = operacoes[id];

            if (operacao === 'enviar') {
                await enviar(evento.caminho, evento.valor);
            } else {
                await deletar(evento.chave);
            }

            dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};
            delete dados_offline[operacao][id];
            localStorage.setItem('dados_offline', JSON.stringify(dados_offline));

        }
    }
}

async function inserirDados(dados, nome_da_base) {
    const modoClone = JSON.parse(localStorage.getItem('modoClone')) || false;
    if (modoClone) nome_da_base = `${nome_da_base}_clone`;

    const db = await abrirBanco('Bases');

    if (!db.objectStoreNames.contains(nome_da_base)) {
        const novaVersao = db.version + 1;
        db.close();
        const upgradedDB = await atualizarVersaoBanco('Bases', novaVersao, nome_da_base);
        await executarTransacao(upgradedDB, nome_da_base, dados);
    } else {
        await executarTransacao(db, nome_da_base, dados);
    }
}

// Função para abrir banco
function abrirBanco(nome) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(nome);
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

// Função para atualizar versão e criar objectStore
function atualizarVersaoBanco(nome, versao, nome_da_base) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(nome, versao);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore(nome_da_base, { keyPath: 'id' });
            console.log(`Store "${nome_da_base}" criada com sucesso.`);
        };

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}


function executarTransacao(db, nome_da_base, dados) {
    return new Promise((resolve, reject) => {
        if (!dados) return resolve();

        const transaction = db.transaction([nome_da_base], 'readwrite');
        const store = transaction.objectStore(nome_da_base);

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
            try {
                if (Array.isArray(dados)) {
                    dados.forEach(item => {
                        item.id = 1;
                        const addRequest = store.put(item);
                        addRequest.onerror = event => console.error('Erro ao adicionar item:', event.target.error);
                    });
                } else {
                    dados.id = 1;
                    const addRequest = store.put(dados);
                    addRequest.onerror = event => console.error('Erro ao adicionar item:', event.target.error);
                }
            } catch (err) {
                reject(err);
            }
        };

        clearRequest.onerror = event => reject(event.target.error);
        transaction.onerror = event => reject(event.target.error);

        transaction.oncomplete = () => resolve();
    });
}

async function recuperarDados(nome_da_base) {
    return new Promise((resolve, reject) => {

        let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false

        if (modoClone) nome_da_base = `${nome_da_base}_clone`

        const request = indexedDB.open('Bases');

        request.onsuccess = function (event) {
            const db = event.target.result;

            // Verificar se a store existe;
            if (!db.objectStoreNames.contains(nome_da_base)) {
                resolve(null);
                return;
            }

            const transaction = db.transaction([nome_da_base], 'readonly');
            const store = transaction.objectStore(nome_da_base);

            const getRequest = store.get(1);

            getRequest.onsuccess = function (event) {
                let dados = event.target.result

                if (dados && dados.id) {
                    delete dados.id
                }

                resolve(event.target.result || null);
            };

            getRequest.onerror = function (event) {
                reject(event.target.error);
            };
        };

        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

function openPopup_v2(elementoHTML, titulo, nao_remover_anteriores) {

    let popup_v2 = `
    <div id="temp_pop" 
    style="
    position: fixed;
    z-index: 10001;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);">

        <div class="janela_fora">
            
            <div style="background-color: transparent; width: 100%; display: flex; justify-content: center; align-items: center;">
                <div class="botao_popup" style="pointer-events: none; width: 100%; display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 5px;">
                    <label style="margin-left: 1vw; margin-right: 3vw; color: white;">${titulo || 'GCS'}</label>
                </div>
                <div style="display: flex; align-items: center; justify-content: center;">

                    <div class="botao_popup" onclick="ajustar_janela(false)">
                        <label>_</label>
                    </div>
                    <div class="botao_popup" onclick="ajustar_janela(true)">
                        <img src="imagens/max.png">
                    </div>
                    <div class="botao_popup" style="border-top-right-radius: 5px; background-color: #b12425;" onclick="remover_popup()">
                        <label>×</label>
                    </div>

                </div>
            </div>
            
            <div class="janela">

                ${elementoHTML}

            </div>

        </div>

    </div>
    `;

    remover_popup(nao_remover_anteriores)
    removerOverlay()
    document.body.insertAdjacentHTML('beforeend', popup_v2);

}

function criarAnexoVisual(nome, link_anexo, funcao_excluir) {

    let displayExcluir = 'flex'

    if (!funcao_excluir) {

        displayExcluir = 'none'

    }

    // Formata o nome para exibição curta
    const nomeFormatado = nome.length > 15
        ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
        : nome;

    return `
        <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 2px; background-color: #222; color: white;">
            <div onclick="abrirArquivo('${link_anexo}')" class="contorno_interno" style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                <img src="imagens/anexo2.png" style="width: 2vw;">
                <label style="font-size: 0.7vw; cursor: pointer;" title="${nome}">${nomeFormatado}</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir}; width: 2vw; cursor: pointer;" onclick="${funcao_excluir}">
        </div>`;
}

let janela_original = { width: '', height: '', maxWidth: '', maxHeight: '' };
let janela_original_simples = { width: '', height: '', maxWidth: '', maxHeight: '' };
let maximizado = false;

function ajustar_janela(ampliar) {
    let janela_fora = document.querySelectorAll('.janela_fora')
    let janela = document.querySelectorAll('.janela')

    janela_fora = janela_fora[janela_fora.length - 1]
    janela = janela[janela.length - 1]

    if (!janela_fora || !janela) return;

    if (ampliar) {
        if (!maximizado) {
            // Salvar tamanhos originais da janela principal
            let estilosFora = getComputedStyle(janela_fora);
            janela_original.width = estilosFora.width;
            janela_original.height = estilosFora.height;
            janela_original.maxWidth = estilosFora.maxWidth;
            janela_original.maxHeight = estilosFora.maxHeight;

            // Salvar tamanhos originais da janela simples
            let estilosJanela = getComputedStyle(janela);
            janela_original_simples.width = estilosJanela.width;
            janela_original_simples.height = estilosJanela.height;
            janela_original_simples.maxWidth = estilosJanela.maxWidth;
            janela_original_simples.maxHeight = estilosJanela.maxHeight;
        }

        // Maximizar
        janela_fora.style.width = '100vw';
        janela_fora.style.maxWidth = '100vw';
        janela_fora.style.height = '98vh';
        janela_fora.style.maxHeight = '100vh';

        janela.style.width = '100%';
        janela.style.height = '100vh';
        janela.style.maxHeight = '100vh';

        maximizado = true;
    } else {
        // Restaurar tamanhos originais
        janela_fora.style.width = janela_original.width;
        janela_fora.style.maxWidth = janela_original.maxWidth;
        janela_fora.style.height = janela_original.height;
        janela_fora.style.maxHeight = janela_original.maxHeight;

        janela.style.width = janela_original_simples.width;
        janela.style.height = janela_original_simples.height;
        janela.style.maxWidth = janela_original_simples.maxWidth;
        janela.style.maxHeight = janela_original_simples.maxHeight;

        maximizado = false;
    }
}

function dicionario(item) {
    return typeof item === "object" && item !== null && item.constructor === Object;
}

function mostrar_ocultar_alertas() {
    var alertas_div = document.getElementById('alertas_div')
    var icone_alerta = document.getElementById('icone_alerta')

    if (alertas_div && icone_alerta) {
        alertas_div.classList.toggle('show');

        if (icone_alerta.style.display == 'flex') {
            icone_alerta.style.display = 'none'
            if (overlay) {
                overlay.style.display = 'block'
            }
        } else {
            remover_popup()
            icone_alerta.style.display = 'flex'
        }

    }
}


// Improved XLSX loading function
async function carregarXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => {
            // Additional check to ensure XLSX is fully initialized
            const checkInitialization = () => {
                if (typeof XLSX !== 'undefined' && typeof XLSX.utils !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        };
        script.onerror = () => reject(new Error("Falha ao carregar a biblioteca XLSX"));
        document.head.appendChild(script);
    });
}


async function para_excel(tabela_id, nome_personalizado) {
    try {
        // 1. Verificação e carregamento da biblioteca
        if (typeof XLSX === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Falha ao carregar a biblioteca XLSX'));
                document.head.appendChild(script);
            });
        }

        // 2. Verificação da tabela
        const tabela = document.getElementById(tabela_id);
        if (!tabela) {
            throw new Error(`Tabela com ID '${tabela_id}' não encontrada`);
        }

        // 3. Clone e preparação da tabela
        const tabelaClone = tabela.cloneNode(true);

        // Processar elementos interativos
        tabelaClone.querySelectorAll('input, textarea, select').forEach(elemento => {
            const celula = elemento.closest('td, th');
            if (celula) {
                if (elemento.type === 'checkbox') {
                    celula.textContent = elemento.checked ? 'Sim' : 'Não';
                } else if (elemento.tagName === 'SELECT') {
                    celula.textContent = elemento.options[elemento.selectedIndex]?.text || '';
                } else {
                    celula.textContent = elemento.value;
                }
            }
        });

        // Remover elementos não exportáveis
        tabelaClone.querySelectorAll('[data-no-export], .no-export').forEach(el => el.remove());

        // 4. Conversão para Excel
        const worksheet = XLSX.utils.table_to_sheet(tabelaClone);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

        // 5. Nome do arquivo
        const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const nomeArquivo = nome_personalizado
            ? `${nome_personalizado}_${data}.xlsx`
            : `exportacao_${data}.xlsx`;

        // 6. Exportação
        XLSX.writeFile(workbook, nomeArquivo, {
            compression: true
        });

    } catch (erro) {
        console.error("Erro detalhado:", erro);

        // Mensagem amigável para o usuário
        let mensagem = erro.message;
        if (erro.message.includes('XLSX is not defined')) {
            mensagem = "Biblioteca de exportação não carregada. Recarregue a página e tente novamente.";
        }

        openPopup_v2(`
            <div style="color: #b71c1c; padding: 20px; text-align: center;">
                <h3>⚠️ Erro na Exportação</h3>
                <p>${mensagem}</p>
                <div style="margin-top: 20px;">
                    <button onclick="remover_popup()" style="padding: 8px 16px; background: #b71c1c; color: white; border: none; border-radius: 4px;">
                        Fechar
                    </button>
                </div>
            </div>
        `, 'Erro na Exportação');
    }
}

async function remover_popup(nao_remover_anteriores) {

    let pop_ups = document.querySelectorAll('#temp_pop')

    if (nao_remover_anteriores) {
        return
    }

    if (pop_ups.length > 1) {
        pop_ups[pop_ups.length - 1].remove()

    } else {
        pop_ups.forEach(pop => {
            pop.remove()
        })
    }

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }

}

function sair() {
    localStorage.removeItem('acesso')
    window.location.href = 'login.html'
}

function unicoID() {
    var d = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now();
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

function ampliar(url) {
    var div = document.getElementById('imagem_upload');
    document.getElementById('img').src = url
    div.classList.toggle('show');
}

function conversor(stringMonetario) {
    if (typeof stringMonetario === 'number') {
        return stringMonetario;
    } else if (!stringMonetario || stringMonetario.trim() === "") {
        return 0;
    } else {
        stringMonetario = stringMonetario.trim();
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
        var valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {
            return 0;
        }

        return valorNumerico;
    }
}

function dinheiro(valor) {
    if (valor === '') {
        return 'R$ 0,00';
    } else {
        valor = Number(valor);
        return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

function ir_para(modulo) {

    localStorage.setItem('modulo_ativo', modulo)

    window.location.href = 'orcamentos.html'

}

function fecharPopup() {
    var popup = document.getElementById('popup');
    popup.classList.remove('aberto');
}

async function ir_pdf(orcam_) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    localStorage.setItem('pdf', JSON.stringify(dados_orcamentos[orcam_]));

    try {
        const { ipcRenderer } = require('electron');
        const pdfUrl = `pdf.html`;
        ipcRenderer.invoke('open-new-window', pdfUrl);

    } catch {
        window.location.href = `pdf.html`;
    }
}

function criar_orcamento_janela() {

    const { ipcRenderer } = require('electron');

    //novo 28/08/2024;
    ipcRenderer.invoke('open-new-window', 'criar_orcamento.html');
    //window.location.href = ('pdf.html');
}

function removerLinha(select) {
    var linha = select.closest('tr');
    linha.parentNode.removeChild(linha);
}

async function apagar(codigo_orcamento) {
    overlayAguarde()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    if (dados_orcamentos[codigo_orcamento]) {
        delete dados_orcamentos[codigo_orcamento]
        await inserirDados(dados_orcamentos, 'dados_orcamentos')
        deletar(`dados_orcamentos/${codigo_orcamento}`)
    }

    await preencher_orcamentos_v2()
    remover_popup()
}

function formatodata(data) {

    var partes = data.split('/');
    var dia = partes[0];
    var mes = partes[1];
    var ano = partes[2];
    return `${ano}-${mes}-${dia}`;
}

function fechar_popup_composicoes() {
    document.getElementById('retangulo_glass').style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function fechar_popup_logistica() {
    document.getElementById('retangulo_logistica').style.display = 'none'
}

function timestamp(dataStr, horaStr) {
    const [dia, mes, ano] = dataStr.split('/').map(Number);
    const [hora, minuto, segundo] = horaStr.split(':').map(Number);

    const data = new Date(ano, mes - 1, dia, hora, minuto, segundo);
    return data.getTime();
}

async function recuperar_clientes() {

    var acompanhamento_dados_clientes = document.getElementById('acompanhamento_dados_clientes')
    if (acompanhamento_dados_clientes) {
        acompanhamento_dados_clientes.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: left;">
            <img src="gifs/loading.gif" style="width: 50px">
            <label>Aguarde alguns segundos... </label>
        </div>
        `
    }

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let timestamps = {
        alteracao: [],
        inclusao: []
    }

    for (cnpj in dados_clientes) {
        let cliente = dados_clientes[cnpj]
        if (cliente.alteracao) {
            timestamps.alteracao.push(cliente.alteracao)
        }

        if (cliente.inclusao) {
            timestamps.inclusao.push(cliente.inclusao)
        }

    }

    // Verificar os maiores timestamps em cada lista;
    let resultado = {};
    for (let chave in timestamps) {
        if (timestamps[chave].length > 0) {
            let maior = timestamps[chave].reduce((max, item) =>
                item.timestamp > max.timestamp ? item : max
            );
            resultado[chave] = maior;
        }
    }

    if (Object.keys(resultado).length == 0) { // Caso seja a primeira vez de execução;
        resultado = {
            inclusao: {
                data: '01/01/2000',
                hora: '00:00:00'
            }
        }
    }

    let clientes = {};
    for (modalidade in resultado) {

        let data = resultado[modalidade].data
        let hora = resultado[modalidade].hora
        let objeto = await dados_clientes_por_pagina(1, data, hora, modalidade);

        if (objeto.faultstring) {
            return console.log(objeto)
        }

        alimentar_objeto(objeto);

        for (let i = 2; i <= objeto.total_de_paginas; i++) {
            objeto = await dados_clientes_por_pagina(i, data, hora, modalidade);
            alimentar_objeto(objeto);
        }

        function alimentar_objeto(dados) {
            dados.clientes_cadastro.forEach((item) => {
                clientes[item.cnpj_cpf] = {
                    inativo: item.inativo,
                    nome: item.nome_fantasia,
                    cnpj: item.cnpj_cpf,
                    cep: item.cep,
                    cidade: item.cidade,
                    bairro: item.endereco,
                    estado: item.estado,
                    omie: item.codigo_cliente_omie,
                    tags: item.tags,
                    inclusao: {
                        timestamp: timestamp(item.info.dInc, item.info.hInc),
                        data: item.info.dInc,
                        hora: item.info.hInc
                    },
                    alteracao: {
                        timestamp: timestamp(item.info.dAlt, item.info.hAlt),
                        data: item.info.dAlt,
                        hora: item.info.hAlt
                    }
                };
            });
        }

    }

    for (cnpj in clientes) {

        let cliente = clientes[cnpj]

        if (cliente.inativo == 'S' && dados_clientes[cnpj]) {
            delete dados_clientes[cnpj]
        } else {
            dados_clientes[cnpj] = cliente
        }

    }

    await inserirDados(dados_clientes, 'dados_clientes')

    if (acompanhamento_dados_clientes) {
        acompanhamento_dados_clientes.innerHTML = `
            <img src="imagens/omie.png">
            <label style="cursor: pointer;">Atualizar OMIE Clientes</label>
            `
    }

}

async function dados_clientes_por_pagina(pagina, data, hora, modalidade) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/clientes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                pagina: pagina,
                data: data,
                hora: hora,
                modalidade: modalidade
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Erro na requisição: " + response.status);
                }
                return response.json();
            })
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                console.error("Erro:", error);
                reject({});
            });
    });
}

async function recuperar() {

    return new Promise((resolve, reject) => {
        var requisicoes = {
            'vendedores': 'vendedores'
        }

        var alicia_keys = Object.keys(requisicoes);
        var promises = alicia_keys.map(function (api) {
            let url = `https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=${api}`;

            return fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erro ao carregar os dados');
                    }
                    return response.json();
                })
                .then(data => {
                    localStorage.setItem(requisicoes[api], JSON.stringify(data));
                });
        });

        Promise.all(promises)
            .then(() => {
                resolve();
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });
    });
}

function formatartextoHtml(texto) {
    return texto.replace(/\n/g, '<br>');
}

function baixar_em_excel(nome_tabela, filename) {

    var table = document.getElementById(nome_tabela)

    var wb = XLSX.utils.table_to_book(table, { sheet: "GCS" });

    filename = filename ? filename + '.xlsx' : 'excel_data.xlsx';

    XLSX.writeFile(wb, filename);
}

function fecharTabela(nome_tabela) {
    document.getElementById(nome_tabela).style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function calcular() {
    var valor = Number(valor_liquido.value)

    var porcentagem = 0
    icms_toggle.checked == true ? porcentagem = 0.12 : porcentagem = 0.205

    var resultado = valor * 1 / (1 - porcentagem)

    valor_com_imposto.textContent = dinheiro(resultado)
}

function gerar_id_5_digitos() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        id += caracteres.charAt(indiceAleatorio);
    }
    return id;
}

function pesquisar_generico(coluna, texto, filtro, id) {

    filtro[coluna] = String(texto).toLowerCase();

    let tbody = document.getElementById(id);
    let trs = tbody.querySelectorAll('tr');
    let contador = 0

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var mostrarLinha = true;

        for (var col in filtro) {
            var filtroTexto = filtro[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].querySelector('select') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        mostrarLinha ? contador++ : ''

        tr.style.display = mostrarLinha ? '' : 'none';
    });

    let contagem = document.getElementById('contagem')
    if (contagem) {
        contagem.textContent = contador
    }

}

function carregamento(local) {
    var local_elemento = document.getElementById(local)

    local_elemento.innerHTML = '';

    var elemento = `
    <div id="carregamento" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px;">
        <img src="gifs/loading.gif" style="width: 5vw">
        <label style="color: white; font-size: 1.5em;">Aguarde...</label>
    </div>
    `
    local_elemento.insertAdjacentHTML('beforeend', elemento)
}

async function salvar_levantamento(id_orcamento) {
    let elemento = document.getElementById("adicionar_levantamento");

    if (!elemento || !elemento.files || elemento.files.length === 0) {
        return;
    }

    try {
        let anexos = await anexo_v2(elemento); // Nova função de upload

        let anexo_dados = {};
        anexos.forEach(anexo => {
            let id_anexo = gerar_id_5_digitos();
            anexo_dados[id_anexo] = anexo;
        });

        if (id_orcamento) {
            let dados_orcamentos = await recuperarDados("dados_orcamentos") || {};
            let orcamento_v2 = dados_orcamentos[id_orcamento] || {};

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            await inserirDados(dados_orcamentos, "dados_orcamentos");

            for (let id_anexo in anexo_dados) {
                await enviar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`, anexo_dados[id_anexo]);
            }

            abrir_esquema(id_orcamento);
        } else {
            let orcamento_v2 = JSON.parse(localStorage.getItem("orcamento_v2")) || {};

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            localStorage.setItem("orcamento_v2", JSON.stringify(orcamento_v2));
            painel_clientes()
        }
    } catch (error) {
        openPopup_v2(`Erro ao fazer upload: ${error.message}`, 'Aviso');
        console.error(error);
    }
}

async function excluir_levantamento(id_orcamento, id_anexo) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcamento]
    delete orcamento.levantamentos[id_anexo]

    await deletar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    abrir_esquema(id_orcamento)

}

async function recuperar_estoque() {

    if (document.getElementById('tela')) {

        overlayAguarde()

        let estoque_nuvem = await receber('dados_estoque') || {}
        await inserirDados(estoque_nuvem, 'dados_estoque')

        let aguarde = document.getElementById('aguarde')
        if (aguarde) {
            aguarde.remove()
        }

    }

}

function filtrar_tabela(coluna, id) {

    let tabela = document.getElementById(id)
    let linhas = Array.from(tabela.tBodies[0].rows)
    let ascendente = tabela.getAttribute("data-order") !== "asc";

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna])
        let valorB = capturarValorCelula(b.cells[coluna])

        if (!isNaN(valorA) && !isNaN(valorB)) {
            return ascendente ? valorA - valorB : valorB - valorA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    });

    let tbody = tabela.tBodies[0];
    linhas.forEach((linha) => tbody.appendChild(linha))

    tabela.setAttribute("data-order", ascendente ? "asc" : "desc")

}

function capturarValorCelula(celula) {
    let entrada = celula.querySelector('input') || celula.querySelector('textarea');
    if (entrada) {
        return entrada.value.toLowerCase();
    }

    let valor = celula.innerText.toLowerCase();

    // 🔥 Exceção para valores monetários no formato "R$ 0,00"
    if (/^r\$\s[\d.,]+$/.test(valor)) {
        // Remove "R$", remove separadores de milhar, substitui vírgula por ponto e converte para número
        valor = valor.replace("r$", "").trim().replace(/\./g, "").replace(",", ".");
        return parseFloat(valor);
    }

    return valor;
}

//--- SERVIÇO DE ARMAZENAMENTO ---\\
async function receber(chave) {

    let chavePartes = chave.split('/')
    let timestamps = []
    let dados = await recuperarDados(chavePartes[0]) || {}

    for ([id, objeto] of Object.entries(dados)) {
        if (objeto.timestamp) timestamps.push(objeto.timestamp)
    }

    const maiorTimestamp = timestamps.length ? Math.max(...timestamps) : 0
    const modoClone = JSON.parse(localStorage.getItem('modoClone')) || false;
    const body = {
        chave: chave,
        app: modoClone ? 'clone' : undefined,
        timestamp: maiorTimestamp
    };

    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
    };

    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/dados", obs)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject({})
            });
    })
}

async function deletar(chave) {
    const url = `https://leonny.dev.br/deletar`;

    let objeto = { chave }

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    if (modoClone) {
        objeto.app = 'clone'
    }

    return new Promise((resolve) => {
        fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(() => {
                salvar_offline(objeto, 'deletar')
                resolve();
            });
    });
}

function enviar(caminho, info) {
    return new Promise((resolve) => {
        let objeto = {
            caminho: caminho,
            valor: info
        };

        let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
        if (modoClone) {
            objeto.app = 'clone'
        }

        fetch("https://leonny.dev.br/salvar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(data => resolve(data))
            .catch((erro) => {
                console.error(erro);
                salvar_offline(objeto, 'enviar');
                resolve();
            });
    });
}

function salvar_offline(objeto, operacao) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    let id = gerar_id_5_digitos()

    if (!dados_offline[operacao]) {
        dados_offline[operacao] = {}
    }

    dados_offline[operacao][id] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

const WS_URL = "wss://leonny.dev.br:8443";
let socket;
let reconnectInterval = 30000;
connectWebSocket();

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        if (acesso) socket.send(JSON.stringify({ tipo: 'autenticar', usuario: acesso.usuario }));
        console.log(`🟢🟢🟢 WS ${data_atual('completa')} 🟢🟢🟢`);
    };

    socket.onmessage = (event) => {
        let data = JSON.parse(event.data);
        let caminho = data?.caminho || ''
        let base = caminho.split('/')[0]

        if (base !== 'registrosAlteracoes' && data.tipo !== 'usuarios_online') console.log('📢', data)

        if (data.tipo == 'usuarios_online') localStorage.setItem('usuariosOnline', JSON.stringify(data.usuarios))

        if (data.tipo == 'livre' && document.title == 'Criar Orçamento') f5()

    };

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${data_atual('completa')} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`);
        setTimeout(connectWebSocket, reconnectInterval);
    };

}

function painelUsuarios(elementoOrigial) {

    let divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios) return divUsuarios.remove()

    let usuariosOnline = JSON.parse(localStorage.getItem('usuariosOnline')) || []
    let dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}

    let stringUsuarios = {
        online: { linhas: '', quantidade: 0 },
        offline: { linhas: '', quantidade: 0 },
    }

    dados_setores = Object.entries(dados_setores).sort((a, b) => a[0].localeCompare(b[0]))

    for ([usuario, objeto] of dados_setores) {

        let status = usuariosOnline.includes(usuario) ? 'online' : 'offline'

        stringUsuarios[status].quantidade++
        stringUsuarios[status].linhas += `
        <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
            <img src="imagens/${status}.png" style="width: 2vw;">
            <label style="font-size: 0.8vw;">${usuario}</label>
            <label style="font-size: 0.6vw;">${objeto.setor}</label>
        </div>
        `
    }

    let pos = elementoOrigial.getBoundingClientRect();

    let acumulado = `
    <div id="divUsuarios" class="divOnline" style="left: ${pos.left + window.scrollX}px; top: ${pos.bottom + window.scrollY}px;">
        <label style="font-size: 0.8vw;"><strong>ONLINE ${stringUsuarios.online.quantidade}</strong></label>
        ${stringUsuarios.online.linhas}
        <label style="font-size: 0.8vw;"><strong>OFFLINE ${stringUsuarios.offline.quantidade}</strong></label>
        ${stringUsuarios.offline.linhas}
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', acumulado)

}

async function gerar_pdf_online(htmlString, nome) {
    return new Promise((resolve, reject) => {
        let encoded = new TextEncoder().encode(htmlString);
        let compressed = pako.gzip(encoded);

        fetch("https://leonny.dev.br/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: compressed
        })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `${nome}.pdf`;
                link.click();
                resolve()
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err)
                reject()
            });
    })

}

async function refazer_pagamento(id_pagamento) {

    openPopup_v2(`
        <div style="margin: 1vw; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <img src="gifs/loading.gif" style="width: 5vw;">
            <label>Aguarde...</label>
        </div>
        `, 'Aviso', true)

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    if (lista_pagamentos[id_pagamento]) {
        remover_popup()
        let pagamento = lista_pagamentos[id_pagamento]
        console.log(await lancar_pagamento(pagamento))
        pagamento.status = 'Pagamento salvo localmente'
        await inserirDados(lista_pagamentos, 'lista_pagamentos')
        await abrir_detalhes(id_pagamento)
    } else {
        openPopup_v2(`
            <div style="margin: 1vw;">
                <label>Atualize os pagamentos e tente novamente.</label>
            </div>
            `, 'Aviso', true)
    }

}

async function lancar_pagamento(pagamento, call) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/lancar_pagamento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagamento, call })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                data = JSON.parse(data)

                if (data.faultstring) {
                    let comentario = `Erro na API ao enviar o pagamento para o Omie! ${data.faultstring}`
                    registrarAlteracao('lista_pagamentos', pagamento.id_pagamento, comentario)
                }

                resolve(data);
            })
            .catch(err => reject(err))
    })
}

function formatarData(dataISO) {
    if (!dataISO) return "--"; // Retorna um placeholder caso a data seja inválida ou vazia

    let partes = dataISO.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // Converte "YYYY-MM-DD" para "DD/MM/YYYY"
    }
    return dataISO; // Retorna a data original caso não esteja no formato esperado
}

async function anexo_v2(arquivoInput) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();

        for (let i = 0; i < arquivoInput.files.length; i++) {
            formData.append('arquivos', arquivoInput.files[i]);
        }

        fetch('https://leonny.dev.br/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                openPopup_v2(`
                    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-direction: column;">
                        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                        <label>🔴🔴🔴 O serviço de armazenamentos está Offline 🔴🔴🔴</label> <br>
                        <label>Fale com um administrador para reiniciar o serviço</label>
                    </div>
                    `)
                reject();
            });
    });
}

function sincronizar(script) {

    fetch('https://leonny.dev.br/sincronizar', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script })
    })
        .then(response => response.text())
        .then(data => {
            console.log(JSON.parse(data));
        })
        .catch(error => console.error('Erro na requisição:', error));

}

function data_atual(estilo, nivel) {
    var dataAtual = new Date();

    if (nivel) {
        // var dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
        var diaDeHoje = dataAtual.getDate();
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();

        if (nivel == 2 && diaDeHoje > 5) { // Pagamento de Parceiro no dia 10 do mês seguinte;
            diaDeHoje = 10;
            mes += 1;
        } else if (nivel == 2) { // Pagamento de Parceiro no dia 10;
            diaDeHoje = 10;
        } else if (nivel == 1) { // Adiantamento de Parceiro (8 dias prévios);
            diaDeHoje += 8;

            var diasNoMes = new Date(ano, mes + 1, 0).getDate();
            if (diaDeHoje > diasNoMes) {
                diaDeHoje -= diasNoMes;
                mes += 1;
            }
        }

        if (mes > 11) {
            mes = 0;
            ano += 1;
        }

        dataAtual = new Date(ano, mes, diaDeHoje);

        if (dataAtual.getDay() === 6) {
            dataAtual.setDate(dataAtual.getDate() + 2);
        } else if (dataAtual.getDay() === 0) {
            dataAtual.setDate(dataAtual.getDate() + 1);
        }

    }

    if (dataAtual.getDay() === 5 && dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 3);
    } else if (dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 2);
    } else if (dataAtual.getDay() === 0) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    } else if (dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    if (estilo === 'completa') {
        var dataFormatada = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return dataFormatada;
    } else if (estilo === 'curta') {
        return dataAtual.toLocaleDateString('pt-BR');
    }
}

async function verAprovacoes() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let guia = {
        aprovado: '#4caf50',
        reprovado: '#ff6b6c',
        pendente: '#ff8c1b',
        desconhecido: '#5cb3ff'
    }

    let cabecalhos = ['Cliente', 'Valor Total', 'Valor Final', 'Localização', 'Usuário', 'Aprovação', 'Comentário', 'Detalhes']
    let tabelas = {
        pendente: { linhas: '' },
        reprovado: { linhas: '' },
        aprovado: { linhas: '' }
    }
    let ths = ''

    cabecalhos.forEach(cabecalho => {
        ths += `<th>${cabecalho}</th>`
    })

    for (let [idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        if (!orcamento.aprovacao) continue

        let dados_orcam = orcamento.dados_orcam || {}
        let aprovacao = orcamento.aprovacao
        let status = aprovacao?.status || 'desconhecido'

        if (!tabelas[status]) tabelas[status] = { linhas: '' }

        tabelas[status].linhas += `
        <tr>
            <td>${dados_orcam?.cliente_selecionado || '--'}</td>
            <td>${aprovacao?.total_sem_desconto}</td>
            <td>${aprovacao?.total_geral}</td>
            <td>${dados_orcam.cidade || ''}</td>
            <td>${aprovacao?.usuario || '--'}</td>
            <td>${status}</td>
            <td>${aprovacao?.justificativa || '--'}</td>
            <td><img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="verPedidoAprovacao('${idOrcamento}')"></td>
        </tr>
        `
    }

    let tabelasString = ''
    for (let [tabela, objeto] of Object.entries(tabelas)) {
        if (objeto.linhas == '') continue
        tabelasString += `
        <br>
        <hr style="width: 100%;">
        <br>
        <table class="tabela" style="width: 100%;">
            <thead style="background-color: ${guia[tabela]};">
                <tr>${ths}</tr>
            </thead>
            <tbody>${objeto.linhas}</tbody>
        </table>`
    }

    acumulado = `
    <div style="background-color: #d2d2d2; border-radius: 3px; padding: 5px;">

        <div style="display: flex; align-items: center; justify-content: start; gap: 5px; width: 100%;">
            <label style="padding: 5px; border-radius: 3px; background-color: ${guia.pendente}">Pendentes</label>
            <label style="padding: 5px; border-radius: 3px; background-color: ${guia.reprovado}">Reprovados</label>
            <label style="padding: 5px; border-radius: 3px; background-color: ${guia.aprovado}">Aprovados</label>
        </div>
        ${tabelasString}
    </div>
    `
    openPopup_v2(acumulado, 'Aprovações de Orçamento', true)
}

async function verificarPendencias() { //29
    await sincronizarDados('dados_orcamentos', true)
    let dados_orcamentos = await recuperarDados('dados_orcamentos')
    let contador = 0

    for ([idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {
        if (orcamento.aprovacao && orcamento.aprovacao.status == 'pendente') contador++
    }

    let contadorPendencias = document.getElementById('contadorPendencias')
    if (contadorPendencias) {
        contadorPendencias.style.display = contador == 0 ? 'none' : 'flex'
        contadorPendencias.textContent = contador
    }

}

async function verPedidoAprovacao(idOrcamento) {

    let acumulado = ''
    let pendentes = false
    let modelo = (valor1, valor2) => {
        return `
            <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <label>${valor1}</label>
                <hr style="width: 100%"> 
                <label style="white-space: nowrap;">${valor2}</label>
            </div>
        `
    }

    pendentes = true
    let tabelas = {}
    let divTabelas = ''
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[idOrcamento]
    let itens = orcamento.dados_composicoes
    let totalSemAcrescimo = 0
    let aprovacao = orcamento.aprovacao

    for ([codigo, composicao] of Object.entries(itens)) {

        let quantidade = composicao.qtde
        let custo = composicao.custo
        let custoOriginal = composicao?.custo_original || false
        let total = quantidade * custo
        let tipo = composicao.tipo
        let desconto = 0
        let labelDesconto = '--'
        let labelLucro = ''
        let labelCusto = dinheiro(custo)
        let labelTotal = dinheiro(total)
        let labelTotalDesconto = dinheiro(total - desconto)

        if (!tabelas[tipo]) tabelas[tipo] = { linhas: '' }

        if (composicao.lucroPorcentagem) labelLucro = `${dinheiro(composicao.lucroLiquido)} [ ${composicao.lucroPorcentagem.toFixed(0)}% ]`

        if (composicao.tipo_desconto) desconto = composicao.tipo_desconto == 'Dinheiro' ? composicao.desconto : total * (desconto / 100)

        if (desconto != 0) labelDesconto = modelo(desconto, labelLucro)

        if (custoOriginal) {
            let totalAcrescimo = custoOriginal * quantidade
            labelCusto = modelo(dinheiro(custo), dinheiro(custoOriginal))
            labelTotal = modelo(dinheiro(total), dinheiro(totalAcrescimo))
            labelTotalDesconto = modelo(dinheiro(total - desconto), dinheiro(totalAcrescimo))
        }

        totalSemAcrescimo += custoOriginal ? custoOriginal : custo

        tabelas[tipo].linhas += `
            <tr>
                <td>${composicao.descricao}</td>
                <td>${quantidade}</td>
                <td>${labelCusto}</td>
                <td>${labelTotal}</td>
                <td>${labelDesconto}</td>
                <td>${labelTotalDesconto}</td>
            </tr>
            `
    }

    for ([tabela, objeto] of Object.entries(tabelas)) {

        divTabelas += `
            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column;">
                <label style="font-size: 1.2vw;"><strong>${tabela}</strong></label>
                <table class="tabela" style="width: 100%;">
                    <thead style="background-color: #a9a5a5;">
                        <tr>
                            <th>Descrição</th>
                            <th>Quantidade</th>
                            <th>Unitário</th>
                            <th>Total</th>
                            <th>Desconto</th>
                            <th>Total com Desconto</th>
                        </tr>
                    </thead>
                    <tbody>${objeto.linhas}</tbody>
                </table>
            </div>
            `
    }

    let mensagem = (valor, termo) => {
        return `
                <div style="display: flex; justify-content: center; flex-direction: column; align-items: start; width: 100%; margin-bottom: 5px;">
                    <label style="font-size: 0.9vw;"><strong>${termo}</strong></label>
                    <label style="font-size: 1.2vw;">${valor}</label>
                </div>
            `
    }

    acumulado += `
            <div class="painelAprovacoes">
                
                <div style="display: flex; align-items: center; justify-content: start; gap: 2vw;">
                    <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                        ${mensagem(orcamento.dados_orcam.analista, 'Solicitante')}
                        ${mensagem(orcamento.dados_orcam.cliente_selecionado, 'Cliente')}
                    </div>
                    <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                        ${mensagem(aprovacao.total_sem_desconto, 'Total Geral')}
                        ${mensagem(aprovacao.total_geral, 'Total Com Desconto')}
                        ${mensagem(aprovacao.desconto_dinheiro, 'Desconto em Dinheiro')}
                        ${mensagem(`${aprovacao.desconto_porcentagem}%`, 'Desconto Percentual')}
                    </div>
                </div>

                <hr style="width: 100%;">

                <div style="display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="visibilidadeOrcamento(this)">
                    <img src="imagens/olhoFechado.png" style="width: 2vw;">
                    <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                    
                </div>

                <div style="display: none; align-items: start; justify-content: center; flex-direction: column; gap: 5px;">
                    ${divTabelas}
                </div>

                <hr style="width: 100%;">
                <div style="width: 100%; position: relative; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">
                    <label>Comentar</label>
                    <textarea rows="5" style="background-color: white; border: none; width: 90%; color: #222;"></textarea>

                    <div style="display: flex; justify-content: left; gap: 5px;">
                        <button style="background-color: #4CAF50;" onclick="resposta_desconto(this, '${id}', 'aprovado')">Autorizar</button>
                        <button style="background-color: #B12425;" onclick="resposta_desconto(this, '${id}', 'reprovado')">Reprovar</button>
                    </div>
                </div>
            </div>

        `

    let permissao = acesso.permissao
    let pessoasPermitidas = ['coordenacao', 'adm', 'diretoria']
    if (pessoasPermitidas.includes(permissao) && pendentes) {
        openPopup_v2(acumulado, 'Detalhes', true)

    } else {
        openPopup_v2(`
            <div style="display: flex; padding: 2vw; gap: 2vw; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Apenas Coordenação, Adms ou diretoria podem acessar</label>
            </div>
            `, 'AVISO', true)
    }
}

function visibilidadeOrcamento(div) {
    let img = div.querySelector('img')
    let label = div.querySelector('label')
    let divTabelas = div.nextElementSibling
    let display = divTabelas.style.display

    if (display == 'none') {
        divTabelas.style.display = 'flex'
        img.src = 'imagens/olhoAberto.png'
        label.textContent = 'Ocultar itens'
    } else {
        divTabelas.style.display = 'none'
        img.src = 'imagens/olhoFechado.png'
        label.textContent = 'Ver itens do Orçamento'
    }
}

function resposta_desconto(botao, id, status) {

    let justificativa = botao.parentElement.parentElement.querySelector('textarea').value

    let aprovacao = {
        usuario: acesso.usuario,
        data: data_atual('completa'),
        status,
        justificativa
    }

    enviar(`aprovacoes/${id}/aprovacao`, aprovacao)
    remover_popup()

}

async function verificar_chamado_existente(chamado, id_atual, sequencial) {
    return new Promise((resolve, reject) => {

        let clone = JSON.parse(localStorage.getItem('modoClone')) || false

        fetch("https://leonny.dev.br/chamado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chamado, id_atual, sequencial, clone })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function configuracoes(usuario, campo, valor) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/configuracoes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, campo, valor })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function servicos(servico, alteracao) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/servicos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ servico, alteracao })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function lista_setores(timestamp) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/setores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

function registrarAlteracao(base, id, comentario) {
    let novoRegistro = {
        usuario: acesso.usuario,
        data: data_atual('completa'),
        comentario: comentario,
        base,
        id
    }

    let idRegistro = gerar_id_5_digitos()

    enviar(`registrosAlteracoes/${idRegistro}`, novoRegistro)
}

function baseOrcamento(orcamento, remover) {

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let app = modoClone ? 'clone' : 'antigos'
    let orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || {}

    let modalidade = document.title == 'Orçamento de Aluguel' ? 'aluguel' : 'orcamento'
    if (orcamento) {
        modalidade = orcamento.lpu_ativa == 'ALUGUEL' ? 'aluguel' : 'orcamento'
    }

    if (!orcamentos[app]) {
        orcamentos[app] = {}
    }

    if (!orcamentos[app][modalidade]) {
        orcamentos[app][modalidade] = {}
    }

    if (orcamento) {
        orcamentos[app][modalidade] = orcamento
        localStorage.setItem('orcamentos', JSON.stringify(orcamentos))

    } else if (remover) {
        delete orcamentos[app][modalidade]
        localStorage.setItem('orcamentos', JSON.stringify(orcamentos))

    } else {
        return orcamentos[app][modalidade]
    }
}

function removerExcluidos(base) {

    if (dicionario(base)) {
        for ([id, objeto] of Object.entries(base)) {
            if (objeto.excluido) delete base[id]
        }
    }

    return base
}

async function sincronizarDados(base, overlayOff) {

    if (!overlayOff) overlayAguarde()

    let nuvem = await receber(base) || {}
    let dados_local = await recuperarDados(base) || {}

    let dadosMesclados = {
        ...dados_local,
        ...nuvem
    }

    removerExcluidos(dadosMesclados)

    await inserirDados(dadosMesclados, base)

    if (!overlayOff) removerOverlay()
}