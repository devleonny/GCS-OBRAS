let anexosProvisorios = {}
let sistemas = {}
let tipos = {}
let prioridades = {}
let empresas = {}
let correcoes = {}
let dados_clientes = {}
let dados_ocorrencias = {}
let ocorrenciasFiltradas = {}
let opcoesValidas = {
    solicitante: new Set(),
    executor: new Set(),
    tipoCorrecao: new Set(),
    finalizado: new Set()
}
let emAtualizacao = false

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

async function carregarElementosPagina(nomeBase, colunas) {

    overlayAguarde()
    const dados = await recuperarDados(nomeBase)
    telaInferior = document.querySelector('.telaInferior')
    telaInferior.innerHTML = modeloTabela({ colunas, base: nomeBase })

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
    await carregarElementosPagina(nomeBase, colunas)
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

    filtrosPagina = {}
    
    mostrarMenus(false)
    titulo.textContent = 'Cadastros'
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

    await carregarBasesAuxiliares('empresas')

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

    if (!dt || '') return '-'

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
    let ocorrencia = dados_ocorrencias[idOcorrencia]

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao]
        deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
        await telaOcorrencias()
        removerPopup()
        return
    }

    deletar(`dados_ocorrencias/${idOcorrencia}`)
    await deletarDB('dados_ocorrencias', idOcorrencia)
    await telaOcorrencias()
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

    const btnExclusao = (acesso.permissao == 'adm' || ocorrencia.usuario == acesso.usuario)
        ? botaoImg('fechar', `confirmarExclusao('${idOcorrencia}')`)
        : ''
    const btnEditar = (acesso.permissao == 'adm' || ocorrencia.usuario == acesso.usuario)
        ? botaoImg('lapis', `formularioOcorrencia('${idOcorrencia}')`)
        : ''
    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'
    const corAssinatura = ocorrencia.assinatura ? '#008000' : '#d30000'

    const partes = `
        <div class="bloco-linha">
            <div style="${horizontal}; justify-content: start; gap: 1px; padding: 5px;">
                ${btnEditar}
                ${btnExclusao}
                <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="telaOS('${idOcorrencia}')">

                <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" onclick="coletarAssinatura('${idOcorrencia}')">
                    <img src="imagens/assinatura.png" style="width: 1.5rem;">
                </div>
            </div>
            
            ${modeloCampos('Empresa', empresas[ocorrencia?.empresa]?.nome || '-')}
            
            <div style="${vertical};">
                <span><b>Descrição:</b></span>
                <span style="text-align: justify;">${ocorrencia?.descricao || '...'}</span>
            </div>
        </div>

        <div class="bloco-linha">
            <span class="etiqueta-chamado">${idOcorrencia}</span>
            ${modeloCampos('Última Correção', status)}
            ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
            ${modeloCampos('Data Limite', dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao))}
            ${modeloCampos('Tipo', tipos?.[ocorrencia?.tipo]?.nome || '...')}
            ${modeloCampos('Unidade', dados_clientes?.[ocorrencia?.unidade]?.nome || '...')}
            ${modeloCampos('Sistema', sistemas?.[ocorrencia?.sistema]?.nome || '...')}
            ${modeloCampos('Prioridade', prioridades?.[ocorrencia?.prioridade]?.nome || '...')}
        </div>

        <div class="bloco-linha">
            ${carregarCorrecoes(idOcorrencia, ocorrencia?.correcoes || {})}
        </div>
    `
    const divExistente = document.getElementById(idOcorrencia)
    if (divExistente) return divExistente.innerHTML = partes

    document.querySelector('.tabela1').insertAdjacentHTML('beforeend', `<div id="${idOcorrencia}" class="div-linha">${partes}</div>`)
}

function carregarCorrecoes(idOcorrencia, correcoes = {}) {

    let divsCorrecoes = ''
    for (const [idCorrecao, correcao] of Object.entries(correcoes)) {

        const imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/GCS/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const edicao = (correcao.executor == acesso.usuario || acesso.permissao == 'adm')
            ? `
        <div style="${horizontal}; justify-content: end; width: 100%; gap: 2px; padding: 0.5rem;"> 
            <button onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">Editar</button>
            <button style="background-color: #B12425;" onclick="confirmarExclusao('${idOcorrencia}', '${idCorrecao}')">Excluir</button>
        </div>
        `
            : ''

        divsCorrecoes += `
            <div class="detalhes-correcoes-1">

                <div style="${vertical}; padding: 0.5rem;">
                    ${modelo('Data da Correção', `<span>${dtFormatada(correcao?.dtCorrecao)}</span>`)}
                    ${modelo('Executor', `<span>${correcao.executor}</span>`)}
                    ${modelo('Correção', `<span>${correcoes?.[correcao.tipoCorrecao]?.nome || '...'}</span>`)}
                    ${modelo('Descrição', `<div style="text-align: justify;">${correcao.descricao}</div>`)}
                    ${modelo('Criado em', `<span>${correcao?.data || 'S/D'}</span>`)}
                </div>


                <div style="${horizontal}">
                    ${edicao}
                    <div style="${vertical}; padding: 0.5rem;">
                        ${imagens !== ''
                    ? `<div class="fotos" style="display: flex;">${imagens}</div>`
                    : '<img src="imagens/img.png" style="width: 4rem;">'}

                        <div id="anexos" style="${vertical};">
                            ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
                        </div>
                    </div>
                </div>
            </div>`
    }

    const acumulado = `
        ${botao('Incluir Correção', `formularioCorrecao('${idOcorrencia}')`, '#e47a00')}
        <div class="detalhamento-correcoes">
            ${divsCorrecoes}
        </div>
    `

    return acumulado

}

async function telaOcorrencias(tipoCorrecao = 'SEM CORREÇÃO') {

    overlayAguarde()
    empresas = await recuperarDados('empresas')
    sistemas = await recuperarDados('sistemas')
    tipos = await recuperarDados('tipos')
    prioridades = await recuperarDados('prioridades')
    correcoes = await recuperarDados('correcoes')
    dados_clientes = await recuperarDados('dados_clientes')

    const empresaAtiva = empresas[acesso?.empresa]?.nome || 'Desatualizado'

    titulo.innerHTML = `${tipoCorrecao} • ${empresaAtiva}`

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

            <div class="rodape-tabela"></div>
        </div>
    `

    telaInterna.innerHTML = acumulado

    const filtrados = ocorrenciasFiltradas?.[tipoCorrecao] || {}
    for (const [idOcorrencia, ocorrencia] of Object.entries(filtrados).reverse()) {

        await criarLinhaOcorrencia(idOcorrencia, ocorrencia)

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

async function atualizarOcorrencias() {

    if (emAtualizacao) return

    emAtualizacao = true
    sincronizarApp()
    let status = { total: 9, atual: 1 }

    sincronizarApp(status)
    const nuvem = await baixarOcorrencias()
    if (nuvem.dados && nuvem.resetar) {
        const base = 'dados_ocorrencias'
        if (nuvem.resetar == 1) await inserirDados({}, base, true)
        await inserirDados(nuvem.dados, base)
    }
    status.atual++

    const basesAuxiliares = [
        'dados_setores',
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
    correcoes = await recuperarDados('correcoes')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    carregarMenus()
}

function sincronizarApp({ atual, total, remover } = {}) {

    if (remover) {

        setTimeout(async () => {
            const loader = document.querySelector('.circular-loader')
            if (loader) loader.remove()
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
        const progresso = document.querySelector('.progresso')
        progresso.innerHTML = carregamentoHTML

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
                if (data.mensagem) {
                    popup(mensagem(data.mensagem), 'Alerta', true)
                    reject()
                }
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

    const linhas = [
        { texto: 'Empresa', elemento: labelBotao('empresa', 'empresas', oc?.empresa, empresas[oc?.empresa]?.nome) },
        { texto: 'Unidade de Manutenção', elemento: labelBotao('unidade', 'dados_clientes', oc?.unidade, dados_clientes[oc?.unidade]?.nome) },
        { texto: 'Sistema', elemento: labelBotao('sistema', 'sistemas', oc?.sistema, sistemas[oc?.sistema]?.nome) },
        { texto: 'Prioridade', elemento: labelBotao('prioridade', 'prioridades', oc?.prioridade, prioridades[oc?.prioridade]?.nome) },
        { texto: 'Tipo', elemento: labelBotao('tipo', 'tipos', oc?.tipo, tipos[oc?.tipo]?.nome) },
        { texto: 'Descrição', elemento: `<textarea rows="7" style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" class="campos">${oc?.descricao || ''}</textarea>` },
        { texto: 'Data Limite para a Execução', elemento: `<input name="dataLimiteExecucao" class="campos" type="date" value="${oc?.dataLimiteExecucao || ''}">` },
        {
            texto: 'Anexos', elemento: `
                <label class="campos">
                    Clique aqui
                    <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia ? idOcorrencia : 'novo'}')">
                </label>
            ` },
        {
            elemento: `
            <div id="anexos" style="${vertical};">
                ${Object.entries(oc?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
            </div>`},
        { elemento: await blocoAuxiliarFotos(oc?.fotos || {}, true) }
    ]

    const botoes = [{ img: 'concluido', texto: 'Salvar', funcao }]

    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Ocorrência' })
    form.abrirFormulario()

    visibilidadeFotos()

}

async function formularioCorrecao(idOcorrencia, idCorrecao) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}
    const funcao = idCorrecao ? `salvarCorrecao('${idOcorrencia}', '${idCorrecao}')` : `salvarCorrecao('${idOcorrencia}')`

    let equipamentos = ''
    for (const [, equip] of Object.entries(correcao?.equipamentos || {})) equipamentos += await maisLabel(equip)

    const linhas = [
        { texto: 'Data', elemento: `<input name="dtCorrecao" type="date" value="${correcao?.dtCorrecao || ''}">` },
        { texto: 'Status da Correção', elemento: labelBotao('tipoCorrecao', 'correcoes', correcao?.tipoCorrecao, correcoes[correcao?.tipoCorrecao]?.nome) },
        { texto: 'Quem fará a atividade?', elemento: labelBotao('executor', 'dados_setores', correcao?.executor || acesso.usuario, correcao?.executor || acesso.usuario) },
        { texto: 'Descrição', elemento: `<textarea style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>` },
        { texto: 'Equipamentos usados', elemento: `<img src="imagens/baixar.png" class="olho" onclick="maisLabel()">` },
        {
            elemento: `<div style="${vertical}; gap: 2px;" id="equipamentos">
                ${equipamentos}
            </div>`},
        { elemento: `${await blocoAuxiliarFotos(correcao?.fotos || {}, true)}` },
        {
            texto: 'Anexos',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <label class="campos">
                    Clique aqui
                    <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia}', '${idCorrecao ? idCorrecao : 'novo'}')">
                </label>
                <div id="anexos" style="${vertical};">
                    ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')` })).join('')}
                </div>
            </div>
            `
        }
    ]
    const botoes = [{ img: 'concluido', texto: 'Salvar', funcao }]
    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Correção' })
    form.abrirFormulario()

    visibilidadeFotos()

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

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (!ocorrencia.correcoes) ocorrencia.correcoes = {}

    if (!ocorrencia.correcoes[idCorrecao]) ocorrencia.correcoes[idCorrecao] = {}

    let correcao = ocorrencia.correcoes[idCorrecao]
    const tipoCorrecao = obter('tipoCorrecao').id

    Object.assign(correcao, {
        dtCorrecao: obter('dtCorrecao').value,
        executor: obter('executor').id,
        data: new Date().toLocaleString(),
        tipoCorrecao,
        descricao: obter('descricao').value
    })

    if (tipoCorrecao == 'WRuo2' && !ocorrencia.assinatura) {
        return coletarAssinatura(idOcorrencia)
    }

    const local = await capturarLocalizacao() || { latitude: null, longitude: null }

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

    await abrirCorrecoes(idOcorrencia)

}

function obter(name) {
    const elemento = document.querySelector(`[name=${name}]`)
    return elemento
}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    const ocorrencia = idOcorrencia
        ? await recuperarDado('dados_ocorrencias', idOcorrencia)
        : {}

    const novo = {
        empresa: obter('empresa')?.id || '',
        unidade: obter('unidade')?.id || '',
        sistema: obter('sistema')?.id || '',
        prioridade: obter('prioridade')?.id || '',
        tipo: obter('tipo')?.id || '',
        dataLimiteExecucao: obter('dataLimiteExecucao')?.value || '',
        descricao: obter('descricao')?.value || '',
        dataRegistro: new Date().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
        anexos: {
            ...ocorrencia.anexos,
            ...anexosProvisorios
        }
    }

    if (!ocorrencia.fotos) ocorrencia.fotos = {}

    const imgs = document.querySelectorAll('.fotos img')

    if (imgs.length > 0) {
        for (const img of imgs) {
            if (img.dataset?.salvo === 'sim') continue
            const foto = await importarAnexos({ foto: img.src })
            const dados = foto[0]
            ocorrencia.fotos[dados.link] = dados
        }
    }

    const salvarLocal = async (id, dados) => {
        await inserirDados({ [id]: dados }, 'dados_ocorrencias')
    }

    if (idOcorrencia) {
        Object.assign(ocorrencia, novo)

        await salvarLocal(idOcorrencia, ocorrencia)
        await criarLinhaOcorrencia(idOcorrencia, ocorrencia)
        enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
        removerPopup()

    } else {

        try {
            const resposta = await enviar('dados_ocorrencias/0000', novo)

            if (resposta.mensagem) {
                popup(mensagem(resposta.mensagem), 'Alerta', true)
            } else {
                await salvarLocal(resposta.idOcorrencia, novo)
                await telaOcorrencias()
            }

            removerPopup()

        } catch (err) {
            popup(mensagem(err.mensagem), 'Alerta', true)
        }
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