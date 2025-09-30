let anexosProvisorios = {}
let sistemas = {}
let tipos = {}
let prioridades = {}
let empresas = {}
let correcoes = {}
let dados_clientes = {}
let dados_ocorrencias = {}
let opcoesValidas = {
    solicitante: new Set(),
    executor: new Set(),
    tipoCorrecao: new Set(),
    finalizado: new Set()
}
let emAtualizacao = false
let ocorrenciasAbertas = null

const labelBotao = (name, nomebase, id, nome) => {
    return `
        <label 
        class="campos" 
        name="${name}"
        ${id ? `id="${id}"` : ''} onclick="cxOpcoes('${name}', '${nomebase}')">
            ${nome ? nome : 'Selecione'} 
        </label>
        `
}

async function carregarElementosPagina(nomeBase, colunas, tela) {

    overlayAguarde()
    const dados = await recuperarDados(nomeBase)
    const telaInterna = document.querySelector(`.${tela ? tela : 'telaInterna'}`)
    telaInterna.innerHTML = modeloTabela({ colunas, base: nomeBase })

    if (nomeBase !== 'dados_composicoes' && nomeBase !== 'dados_clientes') {
        const adicionar = `<button onclick="editarBaseAuxiliar('${nomeBase}')">Adicionar</button>`
        const painelBotoes = document.querySelector('.botoes')
        painelBotoes.insertAdjacentHTML('beforeend', adicionar)
    }

    for (const [id, objeto] of Object.entries(dados)) criarLinha(objeto, id, nomeBase)
    removerOverlay()

}

async function carregarBasesAuxiliares(nomeBase) {
    titulo.textContent = inicialMaiuscula(nomeBase)
    const colunas = ['Nome', '']
    await carregarElementosPagina(nomeBase, colunas, 'telaInferior')
}

async function editarBaseAuxiliar(nomeBase, id) {
    const dados = await recuperarDado(nomeBase, id)
    const funcao = id ? `salvarNomeAuxiliar('${nomeBase}', '${id}')` : `salvarNomeAuxiliar('${nomeBase}')`
    const acumulado = `
        <div class="painel-cadastro">
            <span>Nome</span>
            <input name="nome" placeholder="${inicialMaiuscula(nomeBase)}" value="${dados?.nome || ''}">
        </div>
        <div class="rodape-formulario">
            <button onclick="${funcao}">Salvar</button>
            <span style="margin-left: 5vw;" name="timer"></span>
        </div>
    `

    popup(acumulado, 'Gerenciar', true)

}

async function salvarNomeAuxiliar(nomeBase, id) {

    overlayAguarde()

    id = id || ID5digitos()

    const nome = document.querySelector('[name="nome"]')
    await enviar(`${nomeBase}/${id}/nome`, nome.value)

    let dado = await recuperarDado(nomeBase, id) || {}
    dado.nome = nome.value
    await inserirDados({ [id]: dado }, nomeBase)
    await criarLinha(dado, id, nomeBase)

    removerPopup()

}

async function telaCadastros() {
    mostrarMenus(false)
    titulo.textContent = 'Cadastros'
    const telaInterna = document.querySelector('.telaInterna')
    const bases = ['empresas', 'tipos', 'sistemas', 'prioridades', 'correcoes']
    const acumulado = `
        <div style="${vertical}; gap: 2px;">
            <div class="painel-superior-cadastros">
                ${bases.map(base => `<button onclick="carregarBasesAuxiliares('${base}')">${inicialMaiuscula(base)}</button>`).join('')}
            </div>
            <div class="telaInferior"></div>
        </div>
    `

    telaInterna.innerHTML = acumulado

}

function pararCam() {
    const cameraDiv = document.querySelector('.cameraDiv');
    if (cameraDiv) cameraDiv.style.display = 'none'

    try {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        const video = document.getElementById('video');
        if (!video) return
        video.srcObject = null;
    } catch (err) {
        popup(mensagem(`Falha no plugin: ${err}`))
    }
}

async function blocoAuxiliarFotos(fotos) {

    if (fotos) {

        const imagens = Object.entries(fotos)
            .map(([link, foto]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/GCS/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const painel = `
            <div class="fotos">${imagens}</div>
            <div class="capturar" onclick="blocoAuxiliarFotos()">
                <img src="imagens/camera.png" class="olho">
                <span>Abrir Câmera</span>
            </div>
        `
        return painel

    } else {

        const popupCamera = `
            <div style="${vertical}; gap: 3px; background-color: #d2d2d2;">
                <div class="capturar" style="position: fixed; bottom: 10px; left: 10px; z-index: 10003;" onclick="tirarFoto()">
                    <img src="imagens/camera.png" class="olho">
                    <span>Capturar Imagem</span>
                </div>

                <div class="cameraDiv">
                    <video autoplay playsinline></video>
                    <canvas style="display: none;"></canvas>
                </div>
            </div>
            `
        popup(popupCamera, 'Captura', true)
        await abrirCamera()
    }

}

async function abrirCamera() {
    const cameraDiv = document.querySelector('.cameraDiv');
    const video = cameraDiv.querySelector('video');

    setInterval(pararCam, 5 * 60 * 1000);

    try {
        const modo = isAndroid ? { facingMode: { exact: "environment" } } : true
        stream = await navigator.mediaDevices.getUserMedia({ video: modo });
        video.srcObject = stream;
        cameraDiv.style.display = 'flex';

    } catch (err) {
        popup(mensagem('Erro ao acessar a câmera: ' + err.message), 'Alerta', true);
    }
}

function visibilidadeFotos() {
    const fotos = document.querySelector('.fotos')
    const qtd = fotos.querySelectorAll('img')
    fotos.style.display = qtd.length == 0 ? 'none' : 'grid'
}

async function tirarFoto() {

    const fotos = document.querySelector('.fotos')
    const cameraDiv = document.querySelector('.cameraDiv');
    const canvas = cameraDiv.querySelector('canvas');
    const video = cameraDiv.querySelector('video');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const idFoto = ID5digitos()
    const foto = `<img name="foto" id="${idFoto}" src="${canvas.toDataURL('image/png')}" class="foto" onclick="ampliarImagem(this, '${idFoto}')">`
    fotos.insertAdjacentHTML('beforeend', foto)

    removerPopup()
    visibilidadeFotos()

}

function removerImagem(id) {
    removerPopup()
    const img = document.getElementById(id)
    if (img) img.remove()

    visibilidadeFotos()
}

function ampliarImagem(img, idFoto) {

    const acumulado = `
        <div style="position: relative; background-color: #d2d2d2;">
            <!-- <button style="position: absolute; top: 10px; left: 10px;" onclick="removerImagem('${idFoto}')">Remover Imagem</button> -->
            <img style="width: 95%;" src="${img.src}">
        </div>
    `

    popup(acumulado, 'Imagem', true)

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

function confirmarExclusao(idOcorrencia, idCorrecao) {

    const funcao = idCorrecao ? `excluirInformacao('${idOcorrencia}', '${idCorrecao}')` : `excluirInformacao('${idOcorrencia}')`

    const acumulado = `
        <div style="background-color: #d2d2d2; ${horizontal}; padding: 2vw; gap: 10px;">

            <label>Você tem certeza que deseja excluir?</label>

            <button onclick="${funcao}">Confirmar</button>

        </div>
    
    `
    popup(acumulado, 'Aviso', true)
}

async function excluirInformacao(idOcorrencia, idCorrecao) {

    overlayAguarde()
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao]
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
        await criarLinhaOcorrencia(idOcorrencia, ocorrencia)
        removerPopup()
        return
    }

    await deletar(`dados_ocorrencias/${idOcorrencia}`)
    await deletarDB('dados_ocorrencias', idOcorrencia)
    const tr = document.getElementById(idOcorrencia)
    if (tr) tr.remove()
    removerPopup()

}

async function excluirOcorrenciaCorrecao(idOcorrencia, idCorrecao) {

    removerPopup()
    overlayAguarde()
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao]
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    } else {
        await deletar(`dados_ocorrencias/${idOcorrencia}`)
        await deletarDB('dados_ocorrencias', idOcorrencia)
    }

    await carregarOcorrencias()

    removerOverlay()

}

async function gerenciarCliente(idCliente) {

    const cliente = await recuperarDado('dados_clientes', idCliente)

    const acumulado = `
        <div class="painel-cadastro">
            ${modelo('Nome', cliente.nome)}
            ${modelo('CNPJ', cliente.cnpj)}
            ${modelo('Cidade', cliente.cidade)}
            ${modelo('Endereço', cliente.bairro)}
            ${modelo('Cep', cliente.cep)}
        <div>
    `

    popup(acumulado, 'Gerenciar Cliente')

}

async function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const qtdeCorrecoes = Object.keys(ocorrencia?.correcoes || {}).length

    const btnExclusao = (acesso.permissao == 'adm' || ocorrencia.usuario == acesso.usuario) ? botaoImg('fechar', `confirmarExclusao('${idOcorrencia}')`) : ''

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'

    const corAssinatura = ocorrencia.assinatura ? '#008000' : '#d30000'

    const partes = `
        <div class="linha-parte-1">
            <div style="${horizontal}; justify-content: start; gap: 1px; padding: 5px;">
                ${botaoImg('lapis', `formularioOcorrencia('${idOcorrencia}')`)}
                ${btnExclusao}
                <div class="contador" onclick="abrirCorrecoes('${idOcorrencia}')">
                    <img src="imagens/configuracoes.png" style="width: 2.5rem;">
                    <span>${qtdeCorrecoes}</span>
                </div>
                <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="telaOS('${idOcorrencia}')">

                <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" onclick="coletarAssinatura('${idOcorrencia}')">
                    <img src="imagens/assinatura.png" style="width: 1.5rem;">
                </div>
            </div>

            ${botao('Incluir Correção', `formularioCorrecao('${idOcorrencia}')`, '#e47a00')}

            <div style="${vertical};">
                <span><b>Descrição</b></span>
                <span style="text-align: justify;">${ocorrencia?.descricao || '...'}</span>
            </div>
        </div>

        <div class="linha-parte-2">
            ${modeloCampos('Empresa', empresas[ocorrencia?.empresa]?.nome || '--')}
            ${modeloCampos('Número', idOcorrencia)}
            ${modeloCampos('Última Correção', status)}
            ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
            ${modeloCampos('Data Limite', dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao))}
            ${modeloCampos('Executor', ocorrencia?.executor || '')}
            ${modeloCampos('Tipo', tipos?.[ocorrencia?.tipo]?.nome || '...')}
            ${modeloCampos('Unidade', dados_clientes?.[ocorrencia?.unidade]?.nome || '...')}
            ${modeloCampos('Sistema', sistemas?.[ocorrencia?.sistema]?.nome || '...')}
            ${modeloCampos('Prioridade', prioridades?.[ocorrencia?.prioridade]?.nome || '...')}
        </div>
    `

    const divExistente = document.getElementById(idOcorrencia)
    if (divExistente) return divExistente.innerHTML = partes

    document.querySelector('.tabela1').insertAdjacentHTML('beforeend', `<div id="${idOcorrencia}" class="div-linha">${partes}</div>`)
}

async function abrirCorrecoes(idOcorrencia) {

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    const acumulado = `
    <div class="detalhamento-correcoes">

        <div style="${vertical}">
            <div class="painelBotoes"></div>

            <div class="tabelaCorrecoes"></div>

            <div class="rodapeTabela"></div>
        </div>

    </div>
    `

    if (Object.keys(ocorrencia?.correcoes || {}).length == 0) {
        return popup(mensagem('Ainda sem correções'), 'Alerta')
    }

    popup(acumulado, 'Correções', true)

    for (const [idCorrecao, correcao] of Object.entries(ocorrencia?.correcoes || {})) {
        await carregarLinhaCorrecao(idCorrecao, correcao, idOcorrencia)
    }

}

async function carregarLinhaCorrecao(idCorrecao, correcao, idOcorrencia) {

    const imagens = Object.entries(correcao?.fotos || {})
        .map(([link, foto]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/GCS/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
        .join('')

    const edicao = (correcao.executor == acesso.usuario || acesso.permissao == 'adm')
        ? `
            <div class="botaoImg">
                <img src="imagens/lapis.png" onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">
            </div>
        `
        : ''

    const divLinha = `
    <div class="detalhes-correcoes-1">

        <div style="${horizontal}; gap: 10px;">
            ${edicao}
            <div style="${vertical}">
                ${modelo('Executor', `<span>${correcao.executor}</span>`)}
                ${modelo('Correção', `<span>${correcoes?.[correcao.tipoCorrecao]?.nome || '...'}</span>`)}
                ${modelo('Descrição', `<div style="text-align: justify;">${correcao.descricao}</div>`)}
            </div>
        </div>

        <div style="${vertical}">
            ${imagens !== ''
            ? `<div class="fotos" style="display: grid;">${imagens}</div>`
            : '<span>Sem Imagens</span>'}

            <div id="anexos" style="${vertical};">
                ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
            </div>
        </div>

    </div>
    `
    const existente = document.getElementById(idCorrecao)

    if (existente) return existente.innerHTML = divLinha

    document.querySelector('.tabelaCorrecoes').insertAdjacentHTML('beforeend', `<div class="div-linha" id="${idCorrecao}">${divLinha}</div>`)

}

async function telaOcorrencias(abertos) {

    if (abertos !== undefined) ocorrenciasAbertas = abertos
    if (abertos == undefined && ocorrenciasAbertas !== null) abertos = ocorrenciasAbertas

    mostrarMenus(false)

    overlayAguarde()
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    empresas = await recuperarDados('empresas')
    sistemas = await recuperarDados('sistemas')
    tipos = await recuperarDados('tipos')
    prioridades = await recuperarDados('prioridades')
    correcoes = await recuperarDados('correcoes')
    dados_clientes = await recuperarDados('dados_clientes')

    const empresaAtiva = empresas[acesso?.empresa]?.nome || 'Desatualizado'

    titulo.innerHTML = `${abertos ? 'ABERTOS' : 'SOLUCIONADOS'} • ${empresaAtiva}`

    const acumulado = `
        <div class="tela-ocorrencias">
            <div class="painelBotoes">
                <div class="botoes">
                    <div class="pesquisa">
                        <input oninput="pesquisarOcorrencias(this.value)" placeholder="Pesquisar" style="width: 100%;">
                        <img src="imagens/pesquisar2.png">
                    </div>
                    <div style="${horizontal}; gap: 5px;">
                        ${botao('Nova Ocorrência', 'formularioOcorrencia()')}
                    </div>
                </div>
            </div>

            <div class="tabela1"></div>

            <div class="rodapeTabela"></div>
        </div>
    `

    const telaInterna = document.querySelector('.telaInterna')
    telaInterna.innerHTML = acumulado

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) {

        if (abertos && ocorrencia.tipoCorrecao !== 'WRuo2' || !abertos && ocorrencia.tipoCorrecao == 'WRuo2') {
            await criarLinhaOcorrencia(idOcorrencia, ocorrencia)
        }

    }

    removerOverlay()

}

function pesquisarOcorrencias(termo) {
    const linhas = document.querySelectorAll('.div-linha');
    const pesquisa = termo.trim().toLowerCase();

    for (const linha of linhas) {
        const texto = linha.textContent.toLowerCase();
        if (pesquisa === '' || texto.includes(pesquisa)) {
            linha.style.display = '';
        } else {
            linha.style.display = 'none';
        }
    }
}

async function mostrarQuantidades() {
    let contador = {
        abertos: 0,
        solucionados: 0
    }

    dados_ocorrencias = await recuperarDados('dados_ocorrencias')

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) {

        contador[ocorrencia.tipoCorrecao == 'WRuo2' ? 'solucionados' : 'abertos']++

    }

    criarBadge(contador.abertos, 'abertos')
    criarBadge(contador.solucionados, 'solucionados')
}

function criarBadge(numero, idPai) {

    const idBadge = `badge_${idPai}`
    const badgeExistente = document.getElementById(idBadge)
    if (badgeExistente) badgeExistente.remove()

    const badge = `<span id="${idBadge}" class="pill alert-${idPai}">${numero}</span>`
    const elementoPai = document.getElementById(idPai)
    if (elementoPai) elementoPai.insertAdjacentHTML('beforeend', badge)

}

async function atualizarOcorrencias() {

    await mostrarQuantidades()

    new Promise(async (resolve, reject) => {

        if (emAtualizacao) return

        emAtualizacao = true

        mostrarMenus(true)
        sincronizarApp()
        let status = { total: 9, atual: 1 }

        sincronizarApp(status)
        await sincronizarSetores(true)
        status.atual++

        sincronizarApp(status)
        const nuvem = await baixarOcorrencias()
        await inserirDados(nuvem, 'dados_ocorrencias')
        status.atual++

        const basesAuxiliares = [
            'empresas',
            'dados_composicoes',
            'dados_clientes',
            'sistemas',
            'prioridades',
            'correcoes',
            'tipos'
        ];

        for (const base of basesAuxiliares) {
            sincronizarApp(status)
            await sincronizarDados(base, true)
            status.atual++
        }

        sincronizarApp({ remover: true })

        emAtualizacao = false

        dados_ocorrencias = await recuperarDados('dados_ocorrencias')
        await mostrarQuantidades()
        resolve()
    })

}

function sincronizarApp({ atual, total, remover } = {}) {

    if (remover) {

        setTimeout(async () => {
            const loader = document.querySelector('.circular-loader')
            if (loader) loader.remove()
            if (ocorrenciasAbertas !== null) await telaOcorrencias()
            mostrarMenus(false)
            return
        }, 1000)

        return

    } else if (atual) {

        const circumference = 2 * Math.PI * 50;
        const percent = (atual / total) * 100;
        const offset = circumference - (circumference * percent / 100);
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = offset;
        percentageText.textContent = `${percent.toFixed(0)}%`;

        return

    } else {

        const carregamentoHTML = `
        <div class="circular-loader">
            <svg>
                <circle class="bg" cx="60" cy="60" r="50"></circle>
                <circle class="progress" cx="60" cy="60" r="50"></circle>
            </svg>
            <div class="percentage">0%</div>
        </div>
        `
        const botoesMenu = document.querySelector('.botoesMenu')
        botoesMenu.insertAdjacentHTML('afterbegin', carregamentoHTML)

        progressCircle = document.querySelector('.circular-loader .progress');
        percentageText = document.querySelector('.circular-loader .percentage');
    }

}

async function baixarOcorrencias() {

    const timestampOcorrencia = await maiorTimestamp('dados_ocorrencias')

    async function maiorTimestamp(nomeBase) {

        let timestamp = 0
        const dados = await recuperarDados(nomeBase)
        for (const [id, objeto] of Object.entries(dados)) {
            if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
        }

        return timestamp
    }

    return new Promise((resolve, reject) => {
        fetch(`${api}/ocorrencias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: acesso.usuario, timestampOcorrencia })
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
            .catch(error => reject(error));

    })
}

async function telaUnidades() {

    mostrarMenus(false)
    titulo.textContent = 'Unidades'
    const colunas = ['CNPJ', 'Cidade', 'Nome', '']
    await carregarElementosPagina('dados_clientes', colunas)
}

async function telaEquipamentos() {

    mostrarMenus(false)
    titulo.textContent = 'Equipamentos'
    const colunas = ['Descrição', 'Código', 'Unidade', 'Modelo', 'Fabricante', '']
    await carregarElementosPagina('dados_composicoes', colunas)
}

async function formularioOcorrencia(idOcorrencia) {

    const oc = idOcorrencia ? await recuperarDado('dados_ocorrencias', idOcorrencia) : {}
    const funcao = idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()'

    const acumulado = `
        <div class="painel-cadastro">
            ${modelo('Empresa', labelBotao('empresa', 'empresas', oc?.empresa, empresas[oc?.empresa]?.nome))}
            ${modelo('Unidade de Manutenção', labelBotao('unidade', 'dados_clientes', oc?.unidade, dados_clientes[oc?.unidade]?.nome))}
            ${modelo('Sistema', labelBotao('sistema', 'sistemas', oc?.sistema, sistemas[oc?.sistema]?.nome))}
            ${modelo('Prioridade', labelBotao('prioridade', 'prioridades', oc?.prioridade, prioridades[oc?.prioridade]?.nome))}
            ${modelo('Tipo', labelBotao('tipo', 'tipos', oc?.tipo, tipos[oc?.tipo]?.nome))}
            ${modelo('Descrição', `<textarea rows="7" style="width: 100%;" name="descricao" class="campos">${oc?.descricao || ''}</textarea>`)}
            ${modelo('Data Limite para a Execução', `<input name="dataLimiteExecucao" class="campos" type="date" value="${oc?.dataLimiteExecucao || ''}">`)}
            
            <br>
            ${await blocoAuxiliarFotos(oc?.fotos || {}, true)}
            <br>

            ${modelo('Anexos', `
                    <label class="campos">
                        Clique aqui
                        <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia ? idOcorrencia : 'novo'}')">
                    </label>
                `)}
            <div id="anexos" style="${vertical};">
                ${Object.entries(oc?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
            </div>

        </div>

        <div class="rodape-formulario">
            ${botao('Salvar', funcao)}
            <span class="timer"></span>
        </div>
   `

    popup(acumulado, 'Gerenciar ocorrência')

    dispararTimer()
    visibilidadeFotos()

}

async function formularioCorrecao(idOcorrencia, idCorrecao) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const correcoes = await recuperarDados('correcoes')
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}
    const funcao = idCorrecao ? `salvarCorrecao('${idOcorrencia}', '${idCorrecao}')` : `salvarCorrecao('${idOcorrencia}')`

    let equipamentos = ''
    for (const [id, equip] of Object.entries(correcao?.equipamentos || {})) equipamentos += await maisLabel(equip)

    const acumulado = `
        <div class="painel-cadastro">

            ${modelo('Status da Correção', labelBotao('tipoCorrecao', 'correcoes', correcao?.tipoCorrecao, correcoes[correcao?.tipoCorrecao]?.nome))}        
            ${modelo('Descrição', `<textarea name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>`)}

            <div style="${horizontal}; gap: 5px;">
                <label>Equipamentos usados</label>
                <img src="imagens/baixar.png" class="olho" onclick="maisLabel()">
            </div>
            
            <div style="${vertical}; gap: 2px;" id="equipamentos">
                ${equipamentos}
            </div>

            <br>
            ${await blocoAuxiliarFotos(correcao?.fotos || {}, true)}
            <br>

            ${modelo('Anexos', `
                    <label class="campos">
                        Clique aqui
                        <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia}', '${idCorrecao ? idCorrecao : 'novo'}')">
                    </label>
                `)}

            <div id="anexos" style="${vertical};">
                ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')` })).join('')}
            </div>

        </div>
        <div class="rodape-formulario">
            ${botao('Salvar', funcao)}
            <span class="timer"></span>
        </div>
   `

    popup(acumulado, 'Gerenciar Correção', true)

    dispararTimer()
    visibilidadeFotos()

}

function dispararTimer() {
    const timer = document.querySelector('.timer')

    if (timer) {
        setInterval(() => {
            timer.textContent = new Date().toLocaleString('pt-BR')
        }, 1000)
    }
}

async function maisLabel({ codigo, quantidade, unidade } = {}) {

    let div = document.getElementById('equipamentos')
    const opcoes = ['UND', 'METRO', 'CX'].map(op => `<option ${unidade == op ? `selected` : ''}>${op}</option>`).join('')
    const temporario = ID5digitos()
    let nome = 'Selecionar'
    if (codigo) {
        const produto = await recuperarDado('equipamentos', codigo)
        nome = produto.descricao
    }

    const label = `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/cancel.png" class="olho" onclick="this.parentElement.remove()">
            <div style="${vertical}; gap: 5px;">
                <label class="campos" name="${temporario}" ${codigo ? `id="${codigo}"` : ''} onclick="cxOpcoes('${temporario}', 'dados_composicoes')">${nome}</label>
                <div style="${horizontal}; gap: 5px; width: 100%;">
                    <input style="width: 100%;" class="campos" type="number" value="${quantidade || ''}">
                    <select class="campos">${opcoes}</select>
                </div>
            </div>
        </div> 
    `
    if (codigo) return label

    div.insertAdjacentHTML('beforeend', label)
}

async function salvarCorrecao(idOcorrencia, idCorrecao) {

    overlayAguarde()

    if (!idCorrecao) idCorrecao = ID5digitos()

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (!ocorrencia.correcoes) ocorrencia.correcoes = {}

    if (!ocorrencia.correcoes[idCorrecao]) ocorrencia.correcoes[idCorrecao] = {}

    let correcao = ocorrencia.correcoes[idCorrecao]
    const tipoCorrecao = obter('tipoCorrecao').id

    Object.assign(correcao, {
        executor: acesso.usuario,
        tipoCorrecao,
        usuario: acesso.usuario,
        descricao: obter('descricao').value
    })

    if (tipoCorrecao == 'WRuo2' && !ocorrencia.assinatura) {
        return coletarAssinatura(idOcorrencia)
    }

    const local = await capturarLocalizacao()
    if (isAndroid && !local) return popup(mensagem(`É necessário autorizar o uso do GPS`), 'Alerta', true)

    if (!correcao.datas) correcao.datas = {}
    const data = new Date().getTime()
    correcao.datas[data] = {
        latitude: local.latitude,
        longitude: local.longitude
    }

    correcao.anexos = {
        ...correcao.anexos,
        ...anexosProvisorios
    }

    const fotos = document.querySelector('.fotos')
    const imgs = fotos.querySelectorAll('img')
    if (imgs.length > 0) {
        if (!correcao.fotos) correcao.fotos = {}
        for (const img of imgs) {
            if (img.dataset && img.dataset.salvo == 'sim') continue
            const foto = await importarAnexos({ foto: img.src })
            correcao.fotos[foto[0].link] = foto[0]
        }
    }

    const equipamentos = document.getElementById('equipamentos')

    if (equipamentos) {

        const divs = equipamentos.querySelectorAll('div')
        correcao.equipamentos = {}

        for (const div of divs) {
            const campos = div.querySelectorAll('.campos')
            const idEquip = ID5digitos()
            correcao.equipamentos[idEquip] = {
                codigo: campos[0].id,
                quantidade: Number(campos[1].value),
                unidade: campos[2].value
            }
        }
    }

    ocorrencia.tipoCorrecao = correcao.tipoCorrecao // Atualiza no objeto principal também;

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    await criarLinhaOcorrencia(idOcorrencia, ocorrencia)
    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)
    enviar(`dados_ocorrencias/${idOcorrencia}/tipoCorrecao`, correcao.tipoCorrecao)

    anexosProvisorios = {}
    removerPopup()

}

function obter(name) {
    const elemento = document.querySelector(`[name=${name}]`)
    return elemento
}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    try {

        const campos = ['empresa', 'unidade', 'sistema', 'prioridade', 'tipo']
        let ocorrencia = idOcorrencia ? await recuperarDado('dados_ocorrencias', idOcorrencia) : {}

        for (const campo of campos) {
            const resultado = obter(campo).id

            if (resultado == '') return popup(mensagem(`Preencha o campo ${inicialMaiuscula(campo)}`), 'Alerta', true)

            ocorrencia[campo] = resultado
        }

        ocorrencia.anexos = {
            ...ocorrencia.anexos,
            ...anexosProvisorios
        }

        ocorrencia.usuario = acesso.usuario
        ocorrencia.dataRegistro = new Date().toLocaleString('pt-BR')
        ocorrencia.dataLimiteExecucao = obter('dataLimiteExecucao').value
        ocorrencia.descricao = obter('descricao').value

        if (!ocorrencia.fotos) ocorrencia.fotos = {}

        const fotos = document.querySelector('.fotos')
        const imgs = fotos.querySelectorAll('img')
        if (imgs.length > 0) {
            for (const img of imgs) {
                if (img.dataset && img.dataset.salvo == 'sim') continue
                const foto = await importarAnexos({ foto: img.src })
                ocorrencia.fotos[foto[0].link] = foto[0]
            }
        }

        removerPopup()

        if (idOcorrencia) {
            await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
            await criarLinhaOcorrencia(idOcorrencia, ocorrencia)
            enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)

        } else {

            try {
                const resposta = await enviar('dados_ocorrencias/0000', ocorrencia)
                console.log(resposta);
                
                await inserirDados({ [resposta.idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
                await telaOcorrencias()
            } catch {
                return popup(mensagem('Não foi possível mostrar o seu chamado agora, tente atualizar o app mais tarde.'), 'Alerta', true)
            }

        }

    } catch (err) {
        popup(mensagem(err), 'Alerta', true)
    }

    anexosProvisorios = {}

}

async function anexosOcorrencias(input, idOcorrencia, idCorrecao) {

    overlayAguarde()

    const divAnexos = document.getElementById('anexos')
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    let objeto = {}
    const anexos = await importarAnexos({ input })
    const novo = (idCorrecao == 'novo' || idOcorrencia == 'novo')

    if (novo) {
        objeto = anexosProvisorios
    } else if (idCorrecao) {
        if (!ocorrencia.correcoes[idCorrecao].anexos) ocorrencia.correcoes[idCorrecao].anexos = {}
        objeto = ocorrencia.correcoes[idCorrecao].anexos
    } else {
        if (!ocorrencia.anexos) ocorrencia.anexos = {}
        objeto = ocorrencia.anexos
    }

    anexos.forEach(anexo => {
        const idAnexo = ID5digitos()
        objeto[idAnexo] = anexo

        if (divAnexos) divAnexos.insertAdjacentHTML('beforeend', criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}' ${idCorrecao ? `, '${idCorrecao}'` : ''})` }))

    })

    if (!novo) await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    removerOverlay()

}


async function removerAnexo(img, idAnexo, idOcorrencia, idCorrecao) {

    overlayAguarde()

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao].anexos[idAnexo]
    } else {
        delete ocorrencia.anexos[idAnexo]
    }

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    img.parentElement.remove()

    removerOverlay()

}