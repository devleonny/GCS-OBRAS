let filtroChamados = {}
let idManutencao = null
let statusChamados = null

async function atualizarManutencoes() {
    await sincronizarDados('dados_manutencao')
    await telaChamados()
}

function filtrarManutencoes({ status, col, texto } = {}) {

    const inicio = document.querySelector('[name="inicio"]').value
    const fim = document.querySelector('[name="fim"]').value

    const dtInicio = inicio ? new Date(...inicio.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null
    const dtFinal = fim ? new Date(...fim.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null

    if (status) statusChamados = status

    const trs = document.querySelectorAll('#bodyChamados tr');
    const abas = document.querySelectorAll('.aba-toolbar');

    // resetar abas
    abas.forEach(aba => aba.style.opacity = 0.5);
    const abaAtiva = document.querySelector(`[name="${statusChamados || 'TODOS'}"]`);
    if (abaAtiva) abaAtiva.style.opacity = 1;

    let totais = { TODOS: 0 };

    trs.forEach(tr => {
        const statusLinha = tr.dataset.status;
        const tds = tr.querySelectorAll('td');

        if (!(statusLinha in totais)) totais[statusLinha] = 0;
        totais[statusLinha]++;
        totais['TODOS']++;

        let mostrar = true;


        // filtro de status
        if (statusChamados !== 'TODOS' && statusLinha !== statusChamados) {
            mostrar = false;
        }

        // filtro de coluna
        if (mostrar && col !== null && texto) {
            if (col < tds.length) {
                const conteudo = (tds[col].querySelector('input, textarea, select')?.value
                    || tds[col].textContent || '').toLowerCase();
                if (!conteudo.includes(texto.toLowerCase())) {
                    mostrar = false;
                }
            }
        }

        // filtro de data
        const data = tds[6].querySelector('[name="datas"]').value
        if (dtInicio && dtFinal) {
            const dataConvertida = new Date(...data.split('-').map((v, i) => i === 1 ? v - 1 : v))

            if (!data || (dataConvertida < dtInicio || dataConvertida > dtFinal)) {
                mostrar = false
            }
        }

        tr.style.display = mostrar ? 'table-row' : 'none';
    });

    // atualizar contadores
    abas.forEach(aba => {
        const nome = aba.getAttribute('name');
        const span = aba.querySelector('span');
        if (span && totais[nome] !== undefined) {
            span.textContent = totais[nome];
        }
    });
}

async function telaChamados() {

    overlayAguarde()

    const colunas = ['Última alteração', 'Status', 'Chamado', 'Loja', 'Técnico', 'Analista', 'Previsão', 'Ações']
    let ths = ''
    let tsh = ''
    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`

        if (col == 'Ações') {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`

        } else if (col == 'Previsão') {
            tsh += `
                <th style="${vertical}; align-items: center; gap: 5px; background-color: white;">
                    <input style="width: max-content;" onchange="filtrarManutencoes()" type="date" name="inicio">
                    <input style="width: max-content;" onchange="filtrarManutencoes()" type="date" name="fim">
                </th>
            `
        } else {
            tsh += `<th contentEditable="true" oninput="filtrarManutencoes({col: ${i}, texto: this.textContent})" style="background-color: white;"></th>`
        }
    })

    const acumulado = `
        <div style="margin-left: 10vw;" id="toolbar"></div>
        <div style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table id="chamados" class="tabela" style="font-size: 0.8vw;">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${tsh}</tr>
                    </thead>
                    <tbody id="bodyChamados"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    tela.innerHTML = acumulado
    let contadores = {}
    const dados_manutencao = await recuperarDados('dados_manutencao') || {}
    const dados_clientes = await recuperarDados('dados_clientes') || {}
    for (let [idManutencao, manutencao] of Object.entries(dados_manutencao).reverse()) {
        const cliente = dados_clientes[manutencao.codigo_cliente] || {};
        const tecnico = dados_clientes[manutencao.codigo_tecnico] || {};
        manutencao.cliente = cliente
        manutencao.tecnico = tecnico

        if (!contadores[manutencao.status_manutencao]) contadores[manutencao.status_manutencao] = 0
        contadores[manutencao.status_manutencao]++

        criarLinhaManutencao(idManutencao, manutencao)
    }

    const toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''

    for (const [st, contagem] of Object.entries(contadores)) {

        const label = `
            <div name="${st}" style="opacity: 0.5" class="aba-toolbar" onclick="filtrarManutencoes({status: '${st}'})">
                <label>${inicialMaiuscula(st)}</label>
                <span>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', label)

    }

    filtrarManutencoes({ status: Object.keys(contadores)[0] })

    criarMenus('chamados')

    removerOverlay()
}

function criarLinhaManutencao(idManutencao, manutencao) {

    const tds = `
        <td>${manutencao?.data || '--'}</td>
        <td>${manutencao?.status_manutencao || '--'}</td>
        <td>${manutencao.chamado || 'SEM CHAMADO'}</td>
        <td>
            <div style="${vertical}">
                <span style="text-align: left;">${manutencao?.cliente?.nome || '--'}</span>
                <span><b>${manutencao?.cliente?.cidade || '--'}</b></span>
            </div>
        </td>
        <td>
            <div style="${vertical}">
                <span style="text-align: left;">${manutencao?.tecnico?.nome || '--'}</span>
                <span>${manutencao?.tecnico?.cidade || '--'}</span>
            </div>
        </td>
        <td>${salvarPrimeiroUsuario(manutencao?.historico || manutencao.usuario)}</td>
        <td>
            <input style="display: none;" name="datas" value="${manutencao?.previsao || ''}">
            ${formatarData(manutencao?.previsao) || '--'}
        </td>
        <td style="text-align: center;">
            <img onclick="criarManutencao('${idManutencao}')" src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
        </td>`

    const trExistente = document.getElementById(idManutencao)
    if (trExistente) return trExistente.innerHTML = tds
    document.getElementById('bodyChamados').insertAdjacentHTML(
        'beforeend',
        `<tr data-status="${manutencao.status_manutencao}" id="${idManutencao}">${tds}</tr>`)
}

function imgManut(status) {
    let imagem;

    switch (status) {
        case 'MANUTENÇÃO':
            imagem = 'avencer'
            break
        case 'REQUISIÇÃO AVULSA':
            imagem = 'avulso'
            break
        case 'MATERIAL SEPARADO':
            imagem = 'estoque'
            break
        case 'MATERIAL ENVIADO':
            imagem = 'logistica'
            break
        case 'FINALIZADO':
            imagem = 'concluido'
            break
        case 'EMITIR NOTA':
            imagem = 'financeiro'
            break
        default:
            imagem = 'cancel'
    }

    return imagem
}

function salvarPrimeiroUsuario(historico) {

    if (historico && dicionario(historico)) {
        const primeiraChave = Object.keys(historico)[0];
        return historico[primeiraChave].usuario
    }

    return historico;
}

async function criarManutencao(id) {

    idManutencao = id || ID5digitos()

    const manutencao = await recuperarDado('dados_manutencao', idManutencao)
    const cliente = await recuperarDado('dados_clientes', manutencao?.codigo_cliente)
    const tecnico = await recuperarDado('dados_clientes', manutencao?.codigo_tecnico)

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const tabela = ` 
        <div style="${vertical}; width: 90%;">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody id="linhasManutencao"></tbody>
                    </table>
                </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const opcoes = ['MANUTENÇÃO', 'EMITIR NOTA', 'REQUISIÇÃO AVULSA', 'MATERIAL SEPARADO', 'MATERIAL ENVIADO', 'FINALIZADO', 'REPROVADO']
        .map(op => `<option ${manutencao?.status_manutencao == op ? 'selected' : ''}>${op}</option>`)
        .join('')

    const modelo = (texto, elemento) => `
        <div style="${vertical}">
            <span><b>${texto}</b></span>
            <div class="manutencao-formulario">${elemento}</div>
        </div>
        `
    const kitTecnico = manutencao?.chamado == 'KIT TÉCNICO' ? true : false
    const formulario = `
        <div style="${horizontal}; align-items: start; gap: 1vw; width: 100%; ">
            
            <div style="${vertical}; width: 50%; margin-left: 1vw;">
                ${modelo('Cliente | Loja', `<span ${manutencao?.codigo_cliente ? `id="${manutencao?.codigo_cliente}"` : ''} class="opcoes" name="cliente" onclick="cxOpcoes('cliente', 'dados_clientes', ['nome', 'cnpj', 'endereco'])">${cliente?.nome || 'Selecione'}</span>`)}
                ${modelo('Técnico', `<span ${manutencao?.codigo_tecnico ? `id="${manutencao?.codigo_tecnico}"` : ''} class="opcoes" name="tecnico" onclick="cxOpcoes('tecnico', 'dados_clientes', ['nome', 'cnpj', 'endereco'])">${tecnico?.nome || 'Selecione'}</span>`)}
                ${modelo('Comentário', `<textarea name="comentario" rows="7">${manutencao?.comentario || ''}</textarea>`)}
                
                <br>

                <label class="anexos-formulario" for="anexos">Incluir anexos</label>
                <input type="file" onchange="infoAnexos(this)" id="anexos" style="display: none" multiple>

                <br>
                <div class="arquivos">Sem anexos para importação</div>

                <div id="lista-anexos" style="${vertical}">
                    ${Object.entries(manutencao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, ``)).join('')}
                </div>
                
            </div>

            <div style="${vertical}; width: 50%;">

                ${modelo('Status', `<select name="status_manutencao">${opcoes}</select>`)}

                ${modelo('Kit Técnico', `<input ${kitTecnico ? 'checked' : ''} name="kitTecnico" type="checkbox" style="width: 2vw; height: 2vw; cursor: pointer;" onclick="modoKit(this)">`)}

                ${modelo('Chamado', `<input name="chamado" type="text" value="${manutencao?.chamado || ''}">`)}

                ${modelo('Previsão', `<input name="previsao" type="date" value="${manutencao?.previsao || ''}">`)}
                
                ${modelo('NF', `<input name="nf" value="${manutencao?.nf || ''}">`)}

            </div>

        </div>
        `

    const botoes = `
        <div style="${horizontal}; background-color: #868686ff; width: 100%; gap: 1px; border-top: solid 1px #868686ff;">

            ${layoutBotao('Adicionar Peça', 'criarLinhaPeca()', 'chamados')}
            ${layoutBotao('Salvar', `enviarManutencao('${idManutencao}')`, 'concluido')}
            ${layoutBotao('Sincronizar Estoque', `sincronizarDados('dados_estoque')`, 'estoque')}
            ${layoutBotao('Sincronizar Clientes/Técnicos', `recuperarClientes()`, 'atualizar3')}
            ${layoutBotao('PDF', `gerarPDFChamados()`, 'pdf')}
            ${manutencao ? layoutBotao('Excluir Manutenção', `confirmarExclusaoManutencao('${idManutencao}')`, 'cancel') : ''}

        </div>
        `

    const historico = Object.entries(manutencao?.historico || {})
        .map(([id, dados]) => `
            <div class="item-historico">
                <img src="imagens/${imgManut(dados.status_manutencao)}.png" style="width: 3vw">
                <div style="${vertical}">
                    ${modelo('Data', dados.data)}
                    ${modelo('Status', dados.status_manutencao)}
                    ${modelo('Usuário', dados.usuario)}
                    ${modelo('Comentário', dados.comentario)}
                </div>
            </div>`)
        .join('')

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2;">
            <div name="pdfChamado" style="${vertical}; width: 100%; height: 60vh; overflow: auto; padding: 2vw 0 2vw 0;">
                ${formulario}
                <div style="${horizontal}; width: 100%;">${tabela}</div>
                <br>
                <hr style="width: 90%;">
                <div style="${vertical}; width: 90%;">${historico}</div>
            </div>
            ${botoes}
        </div>
        `

    popup(acumulado, `Requisição de Materiais`)

    modoKit({ checked: kitTecnico })

    for (const [id, peca] of Object.entries(manutencao?.pecas || {})) {
        criarLinhaPeca(id, peca)
    }
}

function salvarPrimeiroUsuario(historico) {

    if (historico && dicionario(historico)) {
        const primeiraChave = Object.keys(historico)[0];
        return historico[primeiraChave].usuario
    }

    return historico;
}

async function gerarPDFChamados() {

    overlayAguarde()

    const dados_estoque = await recuperarDados('dados_estoque')
    const manutencao = await recuperarDado('dados_manutencao', idManutencao)
    const campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    const pessoas = ['tecnico', 'cliente']
    let divs = ''

    console.log(manutencao);


    if (!manutencao) return removerOverlay()

    for (const pessoa of pessoas) {

        let elementos = ''
        const codigo = manutencao[`codigo_${pessoa}`]

        if (codigo == '') continue

        const dados = await recuperarDado('dados_clientes', codigo) || {}

        campos.forEach(campo => {
            elementos += `<label style="text-align: left;"><strong>${campo.toUpperCase()}: </strong>${dados[campo]}</label>`
        })

        divs += `
            <div style="display: flex; flex-direction: column; aling-items: start; justify-content: left;">
                <label style="font-size: 1.5em;">${pessoa.toUpperCase()}</label>
                ${elementos}
            </div>
        `
    }

    let cabecalho = `
        <div style="display: flex; align-items: start; justify-content: left; gap: 10vw;">
            ${divs}
        </div>
    `

    let linhas = ''
    for (const [pc, peca] of Object.entries(manutencao?.pecas || {})) {

        const item = dados_estoque?.[pc] || {}

        linhas += `
        <tr>
            <td>${item.partnumber ?? "-"}</td>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario ?? "-"}</td>
            <td>${peca.descricao ?? "-"}</td>
        </tr>
        `
    }

    const tabela = `
        <label style="font-size: 1.5em;">REQUISIÇÃO ${manutencao.chamado}</label>
        <table class="tabela">
            <thead>
                <th>Part Number</th>
                <th>Quantidade</th>
                <th>Comentário</th>
                <th>Descrição</th>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    `

    const html = `
        <html>

        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    justify-content: start;
                    align-items: start;
                    padding: 3vw;
                    gap: 10px;    
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.0em;
                }

                table {
                    font-size: 1.0em;
                    border-collapse: collapse;
                }
                
                th {
                    background-color: #d2d2d2;
                }

                th, td {
                    border: 1px solid #222;
                    padding: 3px;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    header,
                    footer {
                        display: none !important;
                    }

                    .table-container {
                        margin-right: 0;
                    }
                }                    
            
            </style>
        </head>

        <body>
            <div style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 20px;">
                <img src="https://i.imgur.com/qZLbNfb.png" style="width: 20vw; border-radius: 3px;">
                <label style="font-size: 2.0em;">Requisição de Materiais <br> Manutenção/Avulso</label>
            </div>
            <hr style="width: 90%;">
            ${cabecalho}
            <hr style="width: 90%;">
            ${tabela}
        </body>

        </html>
    `;

    const nome = `REQUISICAO ${manutencao?.chamado || 'Sem chamado'}`

    await gerarPdfOnline(html, nome);

    removerOverlay()
}

function infoAnexos(input) {

    const div = document.querySelector('.arquivos')
    div.innerHTML = ''
    for (const file of input.files) {
        div.innerHTML += `
        <div style="${horizontal}; gap: 10px;">
            <img src="imagens/anexo.png" style="width: 2vw;">
            <span>${String(file.name).slice(0, 15)}...</span>
        </div>
        `
    }
}

function criarLinhaPeca(id, peca) {

    const linhasManutencao = document.getElementById('linhasManutencao')

    id = id || ID5digitos()

    const tds = `
        <td>
            <div style="${horizontal}; justify-content: end; gap: 5px; width: 100%;">
                <span class="opcoes" id="${id}" name="${id}" onclick="cxOpcoes('${id}', 'dados_estoque', ['descricao', 'partnumber'])">${peca?.descricao || 'Selecione'}</span>
                <img data-modalidade="tradicional" src="imagens/ajustar.png" style="width: 1.2rem;" onclick="mudarEdicao(this)">
            </div>
        </td>
        <td contentEditable="true">${peca?.quantidade || peca?.qtde || 0}</td>
        <td contentEditable="true">${peca?.comentario || ''}</td>
        <td><img src="imagens/cancel.png" style="width: 2vw;" onclick="this.parentElement.parentElement.remove()"></td>
    `
    const trExistente = document.getElementById(id)
    if (trExistente) return trExistente.innerHTML = tds
    linhasManutencao.insertAdjacentHTML('beforeend', `<tr id="${id}">${tds}</tr>`)
}

function mudarEdicao(img) {
    const modalidade = img.dataset.modalidade
    const cod = ID5digitos()
    let elemento = ""

    if (modalidade === "livre") {
        elemento = `<span class="opcoes" name="${cod}" onclick="cxOpcoes('${cod}', 'dados_estoque', ['descricao', 'partnumber'])">Selecione</span>`
    } else {
        elemento = `<textarea class="opcoes" name="${cod}"></textarea>`
    }

    img.dataset.modalidade = modalidade == 'livre' ? 'tradicional' : 'livre'
    img.previousElementSibling?.remove()
    img.insertAdjacentHTML("beforebegin", elemento)
}

async function enviarManutencao() {

    idManutencao = idManutencao || ID5digitos()

    overlayAguarde()
    const dados_estoque = await recuperarDados('dados_estoque')
    const obVal = (name) => {
        const elemento = document.querySelector(`[name="${name}"]`)
        return elemento
    }

    let pecas = {}
    const tbody = document.getElementById('linhasManutencao')
    const trs = tbody.querySelectorAll('tr')
    for (const tr of trs) {
        const tds = tr.querySelectorAll('td')
        const codigo = tds[0].querySelector('.opcoes').getAttribute('name')
        const item = dados_estoque?.[codigo] || {}

        pecas[codigo] = {
            partnumber: item?.partnumber || '',
            descricao: tds[0].querySelector('.opcoes')?.textContent || tds[0].querySelector('.opcoes')?.value,
            quantidade: Number(tds[1].textContent),
            comentario: tds[2].textContent
        }
    }

    const manutencao = await recuperarDado('dados_manutencao', idManutencao)
    let novaManutencao = {
        ...manutencao,
        usuario: acesso.usuario,
        previsao: obVal('previsao').value,
        status_manutencao: obVal('status_manutencao').value,
        nf: obVal('nf').value,
        data: new Date().toLocaleString('pt-BR'),
        comentario: obVal('comentario').value,
        chamado: obVal('chamado').value,
        codigo_cliente: obVal('cliente').id,
        codigo_tecnico: obVal('tecnico').id,
        pecas
    }

    const recorte = {
        comentario: novaManutencao.comentario,
        usuario: novaManutencao.usuario,
        data: novaManutencao.data,
        status_manutencao: novaManutencao.status_manutencao
    }

    if (!novaManutencao.historico) novaManutencao.historico = {}

    novaManutencao.historico[ID5digitos()] = recorte

    if (!novaManutencao.anexos) novaManutencao.anexos = {}

    const anexos = document.getElementById('anexos')
    const importacao = await importarAnexos(anexos)

    for (const anexo of importacao) {
        novaManutencao.anexos[anexo.link] = anexo
    }

    await inserirDados({ [idManutencao]: novaManutencao }, 'dados_manutencao')
    enviar(`dados_manutencao/${idManutencao}`, novaManutencao)
    await telaChamados()
    removerPopup()

}

function confirmarExclusaoManutencao(id) {

    popup(`
        <div style="background-color: #d2d2d2; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 2vw;">
            <img src="gifs/alerta.gif" style="width: 3vw;">
            <label>Confirmar exclusão?</label>
            <button style="font-size: 1vw; background-color: green;" onclick="excluirManutencao('${id}')">Confirmar</button>
        </div>
    `, 'Alerta', true)

}

async function excluirManutencao(id) {

    await deletarDB('dados_manutencao', id)

    deletar(`dados_manutencao/${id}`)

    removerPopup()
    removerPopup()

    await telaChamados()

}

function modoKit(input) {
    const chamado = document.querySelector('[name="chamado"]')
    const ativar = input.checked
    chamado.parentElement.parentElement.style.display = ativar ? 'none' : 'flex'
    chamado.value = ativar ? 'KIT TÉCNICO' : ''
}
