let filtro_manutencao = {}
let filtro;

carregar_manutencoes()

async function recuperar_manutencoes() {
    await sincronizarDados('dados_manutencao')
    await carregar_manutencoes()
}

function filtrar_manutencoes(ultimo_status, col, texto) {

    if (ultimo_status !== undefined) {
        filtro = ultimo_status
    }

    if (col !== undefined) {
        filtro_manutencao[col] = String(texto).toLowerCase()
    }

    let tbody = document.getElementById('manutencoes')
    let trs = tbody.querySelectorAll('tr')
    let contadores = {
        TODOS: 0,
        listas: ['TODOS']
    }

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')
        let status = tds[1].textContent

        var mostrarLinha = true;

        for (var col in filtro_manutencao) {
            var filtroTexto = filtro_manutencao[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        if (filtro !== undefined) {
            mostrarLinha = mostrarLinha && (status == filtro || filtro == 'TODOS');
        }

        contadores.listas.push(status)
        if (!contadores[status]) {
            contadores[status] = 0
        }

        if (mostrarLinha || status !== filtro) {
            contadores[status]++
        }

        if (filtro !== 'TODOS' || (filtro == 'TODOS' && mostrarLinha)) {
            contadores['TODOS']++
        }

        mostrarLinha ? tr.style.display = 'table-row' : tr.style.display = 'none'
    })

    let toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''
    contadores.listas = [...new Set(contadores.listas)]

    // Acesse o array dentro do objeto `contadores`
    const listaOriginal = contadores.listas;

    // Nova ordem desejada
    const ordemDesejada = [
        "TODOS",
        "MANUTENÇÃO",
        "REQUISIÇÃO AVULSA",
        "MATERIAL SEPARADO",
        "MATERIAL ENVIADO",
        "REPROVADO"
    ];

    contadores.listas = ordemDesejada.filter(item => listaOriginal.includes(item));

    contadores.listas.forEach(st => {

        let bg = '#797979'
        let bg2 = '#3d3c3c'
        if ((filtro == st || (filtro == undefined && st == 'TODOS'))) {
            bg = '#d2d2d2'
            bg2 = '#222'
        }

        let label = `
        <div onclick="filtrar_manutencoes('${st}')" 
            style="background-color:${bg}; 
            color: #222; 
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            gap: 3px;
            cursor: pointer;
            padding: 10px;
            font-size: 0.8vw;
            color: #222;
            border-top-left-radius: 5px;
            border-top-right-radius: 5px;
            ">

            <label>${inicialMaiuscula(st)}</label>
            <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st]}</label>

        </div>
        `
        toolbar.insertAdjacentHTML('beforeend', label)

    })

}

async function carregar_manutencoes() {

    overlayAguarde()

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}

    if (Object.keys(dados_manutencao).length == 0) {
        await sincronizarDados('dados_manutencao')
        return await carregar_manutencoes()
    }

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    let listaManutencoes = Object.entries(dados_manutencao).sort((a, b) => {
        let [dataA, horaA] = a[1].data.split(", ");
        let [dataB, horaB] = b[1].data.split(", ");

        let dataHoraA = new Date(dataA.split("/").reverse().join("-") + "T" + horaA);
        let dataHoraB = new Date(dataB.split("/").reverse().join("-") + "T" + horaB);

        return dataHoraB - dataHoraA; // Ordem decrescente (mais recente primeiro)
    });

    let linhas = ''
    let status_toolbar = []
    listaManutencoes.forEach(([id, manutencao]) => {
        let dados_clientes = dados_clientes_omie[manutencao.codigo_cliente] || {};
        let dados_tecnicos = dados_clientes_omie[manutencao.codigo_tecnico] || {};

        status_toolbar.push(manutencao.status_manutencao);

        linhas += `
            <tr>
                <td>${manutencao.data}</td>
                <td>${manutencao.status_manutencao}</td>
                <td>${manutencao.chamado || 'SEM CHAMADO'}</td>
                <td>${dados_clientes.nome || '--'}</td>
                <td>${dados_tecnicos.nome || '--'}</td>
                <td>${dados_clientes.cidade || '--'}</td>
                <td>${salvarPrimeiroUsuario(manutencao?.historico || manutencao.usuario)}</td>
                <td>${formatarData(manutencao.previsao) || '--'}</td>
                <td style="text-align: center;">
                    <img onclick="abrir_manutencao('${id}')" src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
                </td>
            </tr>
        `;
    });

    let colunas = ['Última alteração', 'Status', 'Chamado', 'Loja', 'Técnico', 'Cidade', 'Analista', 'Previsão', 'Ações']
    let ths = ''
    let tsh = ''
    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`

        if (col == 'Ações') {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input placeholder="..." style="text-align: left;" oninput="filtrar_manutencoes(undefined, '${i}', this.value)">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>      
        `}
    })

    let tabela = `
        <table id="chamados" class="tabela" style="font-size: 0.8vw;">
            <thead>
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="manutencoes">${linhas}</tbody>
        </table>
    `

    let div_chamados = document.getElementById('chamados')

    if (linhas !== '') {
        div_chamados.innerHTML = tabela

        filtrar_manutencoes('TODOS')
    }

    removerOverlay()
}

async function abrir_manutencao(id) {
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    await criar_manutencao(id)
    if (id) renderizarAnexos(id)
    let manutencao = dados_manutencao[id]
    let pecas = manutencao?.pecas || {}

    document.getElementById('comentario').value = manutencao?.comentario || ''
    document.getElementById('status_manutencao').value = manutencao?.status_manutencao || ''
    document.getElementById('chamado').value = manutencao?.chamado || ''
    document.getElementById('previsao').value = manutencao?.previsao || ''

    let div_NF = document.getElementById("div_NF")

    if (manutencao.status_manutencao == "MATERIAL ENVIADO" || manutencao.status_manutencao == "FINALIZADO") {
        div_NF.style.display = "flex"

        if (manutencao.nf) {
            document.getElementById("NF").value = manutencao.nf
        }
    }

    if (manutencao.chamado == 'KIT TÉCNICO') {
        document.getElementById('kit').checked = true
        document.getElementById('div_chamado').style.display = 'none'
    }

    let pessoas = ['tecnico', 'cliente']
    let labelString = (termo, valor) => {
        return `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: start;">
            <label style="font-size: 0.7vw;"><strong>${termo}</strong></label>
            <label style="text-align: left;">${valor}</label>
        </div>
        `
    }

    pessoas.forEach(pessoa => {
        let chave = `codigo_${pessoa}`

        if (manutencao[chave] && manutencao[chave] !== '') {
            let item = dados_clientes[manutencao[chave]] || {};
            document.getElementById(chave).textContent = manutencao[chave]
            document.getElementById(pessoa).value = item.nome || '--';

            document.getElementById(`endereco_${pessoa}`).innerHTML = `
            ${labelString('CNPJ/CPF', item?.cnpj || '--')}
            ${labelString('Rua/Bairro', item?.bairro || '--')}
            ${labelString('CEP', item?.cep || '--')}
            ${labelString('Cidade', item?.cidade || '--')}
            ${labelString('Estado', item?.estado || '--')}      
        `
        }
    })

    let tamanho = Object.keys(pecas).length
    for (let i = 0; i < tamanho; i++) {
        adicionar_linha_manut()
    }

    let linhas_manutencao = document.getElementById('linhasManutencao')
    let linhas = linhas_manutencao.querySelectorAll('tr')

    let i = 0
    for (id_peca in pecas) {
        let peca = pecas[id_peca]
        let celulas = linhas[i].querySelectorAll('input, textarea')

        let estoques = ['estoque', 'estoque_usado']

        let dic_quantidades = {}

        estoques.forEach(estoque => {

            let estoque_do_objeto = dados_estoque[peca.codigo]?.[estoque] || 0
            let historicos = estoque_do_objeto.historico
            dic_quantidades[estoque] = estoque_do_objeto.quantidade

            for (his in historicos) {
                let historico = historicos[his]

                if (historico.operacao == 'entrada') {
                    dic_quantidades[estoque] += historico.quantidade
                } else if (historico.operacao == 'saida') {
                    dic_quantidades[estoque] -= historico.quantidade
                }
            }

        })

        celulas[0].value = peca.partnumber || dados_estoque[peca.codigo]?.partnumber
        celulas[1].value = peca.descricao
        celulas[2].value = peca.codigo
        celulas[3].value = peca.quantidade
        celulas[4].value = peca.comentario
        celulas[5].value = dic_quantidades.estoque
        celulas[6].value = dic_quantidades.estoque_usado

        i++
    }

    let div_historico = document.getElementById('historico')
    let infos = "";

    for ([his, historico] of Object.entries(manutencao?.historico || {})) {

        let imagem;

        switch (historico.status_manutencao) {
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
            default:
                imagem = 'cancel'
        }

        infos += `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
            <div style="display: flex; flex-direction: column; align-items: start; width: 35%;">
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 5px;">
                    <img src="imagens/${imagem}.png" style="width: 30px;">
                    <div style="text-align: left; display: flex; gap: 0px; flex-direction: column; align-items: start; justify-content: start;">
                        <label><strong>Data: </strong>${historico.data}</label><br>
                        <label><strong>Status: </strong>${historico.status_manutencao}</label><br>
                        <label><strong>Usuário: </strong>${historico.usuario}</label>
                    </div>
                </div>
            </div>
            <div style="width: 70%; display: flex; text-align: center; align-items: center; gap: 8px">
                <label style="text-align: center"><strong>Comentário: </strong></label>
                <textarea style="background-color: white; width: 50%;" readonly>${historico.comentario}</textarea>
            </div>
        </div>
        <hr style="width: 100%;">
        `;
    }

    let elemento = `
        <br>
        <div style="background-color: #797979; color: white; padding: 5px;">Histórico</div>

        <div style="background-color: #d2d2d2; color: #222; padding: 5px;">
            ${infos}
        </div>
        `

    div_historico.insertAdjacentHTML('beforeend', elemento)

}

function salvarPrimeiroUsuario(historico) {

    if (historico && dicionario(historico)) {
        const primeiraChave = Object.keys(historico)[0];
        return historico[primeiraChave].usuario
    }

    return historico;
}

async function capturar_html_pdf(id) {

    overlayAguarde()

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let manutencao = dados_manutencao[id]
    let campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    let pessoas = ['tecnico', 'cliente']
    let divs = ''

    if (!manutencao) return removerOverlay()

    pessoas.forEach(pessoa => {
        let elementos = ''
        let codigo = manutencao[`codigo_${pessoa}`]

        if (codigo !== '') {
            let dados = dados_clientes[codigo] || {}

            campos.forEach(campo => {
                elementos += `<label style="text-align: left;"><strong>${campo.toUpperCase()}: </strong>${dados[campo]}</label>`
            })

            divs += `
                <div style="display: flex; flex-direction: column; aling-items: start; justify-content: left;">
                    <label style="font-size: 1.5em;">${pessoa.toUpperCase()}</label>
                    ${elementos}
                </div>
        `}
    })

    let cabecalho = `
        <div style="display: flex; align-items: start; justify-content: left; gap: 10vw;">
            ${divs}
        </div>
    `

    let pecas = manutencao.pecas

    let linhas = ''
    for (pc in pecas) {
        let peca = pecas[pc]

        if (!pecas) continue
        let partnumber = peca.partnumber ?? (peca.codigo && dados_estoque[peca.codigo]?.partnumber || "CADASTRAR")
        if (partnumber == "undefined") {
            "CADASTRAR"
        }
        linhas += `
        <tr>
            <td>${partnumber ?? "-"}</td>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario ?? "-"}</td>
            <td>${peca.descricao ?? "-"}</td>
        </tr>
        `
    }

    let tabela = `
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

    let html = `
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

    let nome = `REQUISICAO ${manutencao.chamado}`

    await gerar_pdf_online(html, nome);

    removerPopup()
    await abrir_manutencao(id)
}


async function criar_manutencao(id) {

    let displayBotaoAnexos = (acesso.permissao == "adm" || acesso.setor == "LOGÍSTICA") ? "flex" : "none"

    if (!id) id = ID5digitos()

    let tela = `
            <div style="display: flex; align-items: start; justify-content: start; color: #222; padding: 5px; gap: 15px;">
                <div style="display: flex; flex-direction: column; align-items: start;">

                    <label style="font-size: 1.2vw;">Cliente | Loja</label>
                    <label id="codigo_cliente" style="display: none"></label>
                    <div style="position: relative;">
                        <textarea type="text" id="cliente" oninput="sugestoes(this, 'clientes')"
                            placeholder="..."></textarea>
                    </div>

                    <div id="endereco_cliente" style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                    </div>

                </div>

                <div style="position: relative; display: flex; flex-direction: column; align-items: start;">
                    <label style="font-size: 1.2vw;">TÉCNICO</label>
                    <label id="codigo_tecnico" style="display: none"></label>
                    <div style="position: relative;">
                        <textarea type="text" id="tecnico" oninput="sugestoes(this, 'clientes')"
                            placeholder="..."></textarea>
                    </div>

                    <div id="endereco_tecnico" style="display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 3px;">
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: start; gap: 5px;">

                    <div style=" display: flex; align-items: center; justify-content: start; gap: 20px;">
                        <label style="font-size: 1.2vw;">Status</label>
                        <select onchange="aparecer_campo_nf(this)" id="status_manutencao"
                            style="padding: 5px; border-radius: 3px; cursor: pointer; width: 10vw; font-size: 0.8vw;">
                            <option>MANUTENÇÃO</option>
                            <option>EMITIR NOTA</option>
                            <option>REQUISIÇÃO AVULSA</option>
                            <option>MATERIAL SEPARADO</option>
                            <option>MATERIAL ENVIADO</option>
                            <option>FINALIZADO</option>
                            <option>REPROVADO</option>
                        </select>
                    </div>

                    <div
                        style="display: flex; align-items: center; justify-content: left; gap: 20px;">
                        <label style="font-size: 1.2vw;">Kit Técnico</label>
                        <input id="kit" type="checkbox" style="width: 2vw; height: 2vw; cursor: pointer;"
                            onclick="alterar_kit(this)">
                    </div>

                    <div id="div_chamado"
                        style="display: flex; align-items: center; justify-content: left; gap: 20px;">
                        <label style="font-size: 1.2vw;">Chamado</label>
                        <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text"
                            placeholder="..." id="chamado">
                    </div>

                    <div id="div_previsao"
                        style="display: flex; align-items: center; justify-content: left; gap: 20px;">
                        <label style="font-size: 1.2vw;">Previsão</label>
                        <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="date"
                            placeholder="..." id="previsao">
                    </div>

                    <div id="div_NF"
                        style="display: none; align-items: center; justify-content: left; gap: 20px;">
                        <label style="font-size: 1.2vw;">NF</label>
                        <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text"
                            placeholder="..." id="NF">
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: start; width: 100%;">
                        
                        <label style="font-size: 1.2vw;">Comentário</label>
                        <textarea type="text" placeholder="..." id="comentario" style="width: 90%;"></textarea>
                    </div>

                    <div style="display: flex; justify-content: start; align-items: center; gap: 5px; width: 100%;">
                        <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                            <label style="font-size: 1.2vw;">Anexos</label>
                            <label class="contorno_botoes" for="anexo_pedido" style="display: ${displayBotaoAnexos}; justify-content: center; border-radius: 50%;">
                                <img src="imagens/anexo.png" style="cursor: pointer; width: 1vw;">
                                <input type="file" id="anexo_pedido" style="display: none;" onchange="salvar_anexos_manutencao(this, '${id}')">
                            </label>
                        </div>
                        <label onclick="mostrar_anexos(this)" style="text-decoration: underline; cursor: pointer;">Exibir</label>
                    </div>
                    
                    <div id="lista-anexos" style="display: none; align-items: start; justify-content: start; flex-direction: column;"></div>
                </div>

            </div>
            `
    let tabela = ` 
            <hr style="width: 100%;">
            <table class="tabela">

                <thead style="background-color: #797979;">
                    <tr>
                        <th style="color: white;">Part Number</th>
                        <th style="color: white;">Descrição</th>
                        <th style="color: white;">Quantidade</th>
                        <th style="color: white;">Comentário</th>
                        <th style="color: white;">Estoque</th>
                        <th style="color: white;">Estoque Usado</th>
                        <th style="color: white;">Remover</th>
                    </tr>
                </thead>

                <tbody id="linhasManutencao">
                    <tr id="excluir_inicial">
                        <td colspan="7" style="text-align: center;">Lista Vazia</td>
                    </tr>
                </tbody>

            </table>
        `

    let layoutBotao = (nome, funcao, img) => `
                <div onclick="${funcao}" class="botoesChamado">
                    <img src="imagens/${img}.png" style="cursor: pointer; width: 2vw;">
                    <label>${nome}</label>
                </div>
            `

    let botoes = `
            <div style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 2px;">

                ${layoutBotao('Adicionar Peça', 'adicionar_linha_manut()', 'chamados')}
                ${layoutBotao('Salvar', `enviar_manutencao('${id}')`, 'estoque')}
                ${layoutBotao('PDF', `capturar_html_pdf('${id}')`, 'pdf')}
                ${layoutBotao('Sincronizar Clientes/Técnicos', `atualizar_base_clientes()`, 'atualizar3')}
                ${layoutBotao('Sincronizar Estoque', `sincronizarEstoque()`, 'cloudsync')}
                ${layoutBotao('Excluir Manutenção', `confirmarExclusao('${id}')`, 'cancel')}

            </div>
        `
    let acumulado = `
        <div style="width: 60vw; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #d2d2d2; padding: 5px;">
            <div class="telaChamado">
                ${tela}
                ${tabela}
                <div id="historico" style="width: 100%;"></div>
            </div>
            ${botoes}
        </div>
        `

    popup(acumulado, `Requisição de Materiais`)
}

async function sincronizarEstoque() {
    await sincronizarDados('dados_estoque')
}

function mostrar_anexos(label) {

    label.textContent = label.textContent === 'Exibir' ? 'Ocultar' : 'Exibir';

    let display = 'none'

    if (label.textContent !== 'Exibir') {
        display = 'flex'
    }

    label.parentElement.nextElementSibling.style.display = display
}

function confirmarExclusao(id) {

    popup(`
        <div style="display: flex; align-items: center; justify-content: center; gap: 2vw;">
            <img src="gifs/alerta.gif" style="width: 3vw;">
            <label>Confirmar exclusão?</label>
        </div>
        <button style="font-size: 1vw; background-color: green;" onclick="excluir_manutencao('${id}')">Confirmar</button>
    `)

}

async function excluir_manutencao(id) {
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}

    delete dados_manutencao[id]

    await inserirDados(dados_manutencao, 'dados_manutencao')

    deletar(`dados_manutencao/${id}`)

    removerPopup()

    await carregar_manutencoes()

}

function aparecer_campo_nf(input_status) {


    if (input_status.value == "MATERIAL ENVIADO" || input_status.value == "FINALIZADO") {

        let div_NF = document.getElementById("div_NF")

        div_NF.style.display = "flex"

    } else {

        div_NF.style.display = "none"

    }

}

function alterar_kit(checkbox) {
    let chamado = document.getElementById('chamado')
    let div_chamado = document.getElementById('div_chamado')

    if (checkbox.checked) {
        chamado.value = 'KIT TÉCNICO'
        div_chamado.style.display = 'none'
    } else {
        chamado.value = ''
        div_chamado.style.display = 'flex'
    }
}

async function enviar_manutencao(id) {

    overlayAguarde()

    let campos = ['codigo_tecnico', 'codigo_cliente', 'comentario', 'status_manutencao', 'chamado']
    let manutencao = {}
    manutencao.usuario = acesso.usuario
    manutencao.analista = acesso.nome_completo

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    manutencao.historico = dados_manutencao[id]?.historico || {}

    manutencao.status_manutencao = document.getElementById('status_manutencao').value;

    let previsao = document.getElementById('previsao');

    if (previsao && previsao.value) {
        let partes = previsao.value.split("/");
        if (partes.length === 3) {
            manutencao.previsao = `${partes[2]}-${partes[1]}-${partes[0]}`;
        } else {
            manutencao.previsao = previsao.value;
        }
    } else {
        manutencao.previsao = "";
    }

    let NF = document.getElementById("NF");
    manutencao.nf = NF && NF.value ? NF.value : "";
    let data = data_atual('completa')

    // Adiciona uma nova entrada ao histórico
    let novaAtualizacao = {
        data,
        status_manutencao: manutencao.status_manutencao,
        usuario: manutencao.usuario,
        comentario: document.getElementById('comentario').value
    };

    // Gera uma chave única para a nova atualização
    let chaveAtualizacao = ID5digitos();
    manutencao.historico[chaveAtualizacao] = novaAtualizacao;

    let tabela = document.getElementById('linhasManutencao')
    let linhas = tabela.querySelectorAll('tr')

    let pecas = {}
    linhas.forEach(linha => {
        let celulas = linha.querySelectorAll('input, textarea')
        if (celulas.length > 0) {
            pecas[ID5digitos()] = {
                partnumber: celulas[0].value,
                descricao: celulas[1].value,
                codigo: celulas[2].value,
                quantidade: celulas[3].value,
                comentario: celulas[4].value
            }
        }
    })

    manutencao.pecas = pecas
    manutencao.data = data

    campos.forEach(campo => {
        let elemento = document.getElementById(campo)
        if (elemento) {
            manutencao[campo] = elemento.value || elemento.textContent
        }
    })

    let kit = document.getElementById('kit')
    if (kit.checked) manutencao.chamado = 'KIT TÉCNICO'

    // Anexos 
    manutencao.anexos = {
        ...dados_manutencao[id]?.anexos || {}
    }

    enviar(`dados_manutencao/${id}`, manutencao)
    dados_manutencao[id] = manutencao

    await inserirDados(dados_manutencao, 'dados_manutencao')

    removerPopup()

    await carregar_manutencoes()

}

function adicionar_linha_manut() {
    let tbody = document.getElementById('linhasManutencao')
    let aleatorio = ID5digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
            <tr>

                <td>
                    <textarea class="espacos" type="text"></textarea>
                </td>

                <td>
                    <textarea class="espacos" type="text" id="${aleatorio}" oninput="sugestoes(this, 'estoque')"></textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div>
                    <input id="input_${aleatorio}" style="display: none;">
                </td>

                <td>
                    <textarea class="espacos" type="number"></textarea>
                </td>

                <td>
                    <textarea class="espacos"></textarea>
                </td>

                <td>
                    <textarea class="espacos" readonly></textarea>
                </td>

                <td>
                    <textarea class="espacos" readonly></textarea>
                </td>

                <td style="text-align: center;">
                    <img src="imagens/remover.png" onclick="remover_esta_linha(this)" style="width: 30px; cursor: pointer;">
                </td>

            </tr>
            `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_esta_linha(td) {
    let linha_completa = td.parentElement.parentElement
    if (linha_completa) {
        linha_completa.remove()
    }
}

async function sugestoes(textarea, base) {

    let query = String(textarea.value).toLowerCase()
    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) {
        div_sugestoes.remove()
    }

    if (query === '') {
        let campo = textarea.id
        let endereco = document.getElementById(`endereco_${campo}`)

        if (endereco) {
            document.getElementById(`codigo_${campo}`).innerHTML = ''
            endereco.innerHTML = ''
            return
        }

        return
    }

    let dados = await recuperarDados(`dados_${base}`) || {}
    let opcoes = ''

    for ([id, item] of Object.entries(dados)) {

        let conteudoOpcao;

        if (base == 'clientes') {

            let cnpj = item.cnpj.replace(/[./-]/g, '')
            let nome = item.nome.toLowerCase()

            if (!cnpj.includes(query) && !nome.includes(query)) continue

            conteudoOpcao = `
            <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                <label style="font-size: 0.9vw;">${item.nome}</label>
                <label style="font-size: 0.7vw;"><strong>${item.cnpj}</strong></label>
            </div>
            `

        } else if (base == 'estoque') {

            let descricao = String(item.descricao).toLocaleLowerCase()

            if (!descricao.includes(query)) continue

            conteudoOpcao = String(item.descricao)
        }

        opcoes += `
            <div onclick="definirCampo(this, '${textarea.id}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${conteudoOpcao}</div>
        `

    }

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div = `
    <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
        ${opcoes}
    </div>`

    document.body.insertAdjacentHTML('beforeend', div)

}

async function definirCampo(elemento, campo, id) {

    let termo;

    if (campo == 'tecnico' || campo == 'cliente') {

        let dados_clientes = await recuperarDados('dados_clientes') || {}
        let cliente = dados_clientes[id]

        dadosEndereco = `
            <label><strong>CNPJ/CPF:</strong> ${id}</label>
            <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${cliente.bairro}</label>
            <label><strong>CEP:</strong> ${cliente.cep}</label>
            <label><strong>Cidade:</strong> ${cliente.cidade}</label>
            <label><strong>Estado:</strong> ${cliente.estado}</label>
            `
        let endereco = document.getElementById(`endereco_${campo}`)
        endereco.innerHTML = dadosEndereco

        let codigo = document.getElementById(`codigo_${campo}`)
        if (codigo) codigo.textContent = cliente.omie

        termo = cliente.nome

    } else {

        termo = elemento.textContent

        let input_aleatorio = document.getElementById(`input_${campo}`)
        input_aleatorio.value = id

        let dados_estoque = await recuperarDados('dados_estoque') || {}
        let estoques = ['estoque', 'estoque_usado']

        let dic_quantidades = {}

        estoques.forEach(estoque => {

            let estoque_do_objeto = dados_estoque[id][estoque]
            let historicos = estoque_do_objeto.historico
            dic_quantidades[estoque] = estoque_do_objeto.quantidade


            for (his in historicos) {
                let historico = historicos[his]

                if (historico.operacao == 'entrada') {
                    dic_quantidades[estoque] += historico.quantidade
                }

                if (historico.operacao == 'saida') {
                    dic_quantidades[estoque] -= historico.quantidade
                }
            }

            let div_linha = input_aleatorio.parentElement.parentElement

            let inputs = div_linha.querySelectorAll('input, textarea')

            inputs[0].value = dados_estoque[id].partnumber
            inputs[5].value = dic_quantidades.estoque
            inputs[6].value = dic_quantidades.estoque_usado
        })

    }

    let div_sugestoes = document.getElementById('div_sugestoes')
    if (div_sugestoes) div_sugestoes.remove()

    document.getElementById(campo).value = termo
}

async function atualizar_base_clientes() {

    overlayAguarde()
    await recuperarClientes()
    removerOverlay()

}

async function filtrarTabelaPorData() {
    let dataDe = document.getElementById("dataDe").value;
    let dataAte = document.getElementById("dataAte").value;
    let trs = document.querySelectorAll("#manutencoes tr");
    let encontrou = false;

    // 🔥 Remove a mensagem antes de começar a filtragem
    let mensagem = document.getElementById("aviso-vazio");
    if (mensagem) mensagem.remove();

    trs.forEach(tr => {
        let tds = tr.querySelectorAll("td");
        let dataCelula = tds[7]?.textContent.trim();
        let previsaoFormatada = dataCelula.split("/").reverse().join("-"); // "DD/MM/YYYY" -> "YYYY-MM-DD"

        let incluir = (previsaoFormatada >= dataDe && previsaoFormatada <= dataAte);

        const dataNaoEncontrada = !(dataDe && dataAte)
        if (dataNaoEncontrada) {
            incluir = true;
        }

        if (dataDe) {
            incluir = (previsaoFormatada >= dataDe);
        }

        if (dataAte) {
            incluir = (previsaoFormatada <= dataAte);
        }

        tr.style.display = incluir ? "table-row" : "none";

        if (incluir) encontrou = true; // 🔥 Marca que encontrou pelo menos uma manutenção
    });

    let tbody = document.getElementById("manutencoes");

    // 🔥 Se não encontrou nenhuma, adiciona a mensagem
    if (!encontrou) {
        let aviso = document.createElement("tr");
        aviso.id = "aviso-vazio";
        aviso.innerHTML = `<td colspan="9" style="text-align:center; font-weight:bold; color:black;">Nenhuma manutenção encontrada</td>`;
        tbody.appendChild(aviso);
    }
}

let manutencoes_pendentes = {};

async function salvar_anexos_manutencao(input, id) {
    if (!id) {
        return;
    }

    let anexos = await importarAnexos(input); // Simulação da função de upload
    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao');
    let dados_manutencao = await recuperarDados('dados_manutencao') || {};
    let manutencao = dados_manutencao[id];

    // 🛑 Se o manutencao ainda não existe, salva os anexos temporariamente
    if (!manutencao) {
        if (!manutencoes_pendentes[id]) {
            manutencoes_pendentes[id] = { anexos: {} };
        }
        anexos.forEach(anexo => {
            manutencoes_pendentes[id].anexos[anexo.link] = anexo;
        });
        renderizarAnexos(id);
        return;
    }

    // 🔥 Garante que a estrutura de anexos exista
    if (!manutencao.anexos) {
        manutencao.anexos = {};
    }

    anexos.forEach(anexo => {
        manutencao.anexos[anexo.link] = anexo;
        enviar(`dados_manutencao/${id}/anexos/${anexo.link}`, anexo);
    });

    // Atualiza localmente
    await inserirDados(dados_manutencao, 'dados_manutencao');

    // Recarrega os anexos no modal
    await renderizarAnexos(id);

}

async function renderizarAnexos(id) {
    let listaAnexos = document.getElementById("lista-anexos");
    if (!listaAnexos) return;

    let dados_manutencao = await recuperarDados('dados_manutencao') || {};
    let manutencao = dados_manutencao[id] || {}; // Se não existir, inicia vazio
    let anexosBanco = manutencao.anexos || {}; // Anexos já salvos no banco
    let anexosPendentes = manutencoes_pendentes[id]?.anexos || {}; // Anexos pendentes

    // 🔹 Combina os anexos do banco e os pendentes
    let anexos = { ...anexosBanco, ...anexosPendentes };

    // 🔸 Se ainda não há anexos, exibir mensagem
    if (Object.keys(anexos).length === 0) {
        listaAnexos.textContent = 'Sem anexos disponíveis'
        return;
    }

    // 🔹 Renderiza os anexos (banco + pendentes)
    listaAnexos.innerHTML = Object.values(anexos)
        .map(anexo => {
            return criarAnexoVisual(
                anexo.nome,
                anexo.link,
                `removerAnexoChamados('${id}', '${anexo.link}')`
            );
        })
        .join("");
}

async function removerAnexoChamados(id, linkAnexo) {

    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let manutencao = dados_manutencao[id]

    if (!manutencao || !manutencao.anexos || !manutencao.anexos[linkAnexo]) return;

    // Remove da nuvem
    deletar(`dados_manutencao/${id}/anexos/${linkAnexo}`);

    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')

    // Atualiza a interface
    renderizarAnexos(id);
}

