let filtro_manutencao = {}
let filtro;

carregar_manutencoes()

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

            <label>${inicial_maiuscula(st)}</label>
            <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st]}</label>

        </div>
        `
        toolbar.insertAdjacentHTML('beforeend', label)

    })

}

async function carregar_manutencoes(sincronizar) {

    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_clientes_omie = {}

    if (Object.keys(dados_manutencao).length == 0 || sincronizar) {
        await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')
        dados_manutencao = await recuperarDados('dados_manutencao') || {}
    }

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    // 🔥 ORDENANDO DO MAIS RECENTE PARA O MENOS RECENTE
    let listaManutencoes = Object.entries(dados_manutencao).sort((a, b) => {
        let [dataA, horaA] = a[1].data.split(", "); // Separando data e hora
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

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }
}

async function abrir_manutencao(id) {
    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let dados_clientes_omie = {}

    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

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

    pessoas.forEach(pessoa => {

        let chave = `codigo_${pessoa}`

        if (manutencao[chave] && manutencao[chave] !== '') {

            let item = dados_clientes_omie[manutencao[chave]]
            document.getElementById(chave).textContent = manutencao[chave]
            document.getElementById(pessoa).value = item.nome
            document.getElementById(`endereco_${pessoa}`).innerHTML = `
                <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
                <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
                <label><strong>CEP:</strong> ${item.cep}</label>
                <label><strong>Cidade:</strong> ${item.cidade}</label>
                <label><strong>Estado:</strong> ${item.estado}</label>        
            `
        }
    })

    let tamanho = Object.keys(pecas).length
    for (let i = 0; i < tamanho; i++) {
        adicionar_linha_manut()
    }

    let linhas_manutencao = document.getElementById('linhas_manutencao')
    let linhas = linhas_manutencao.querySelectorAll('.linha')

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

    let historicos = manutencao.historico || {};/*{}
    if (manutencao.historico) {
        historicos = manutencao.historico
    } codigo antigo*/

    //historicos[id] = manutencao // Acrescentei o objeto atual para que ele entre no histórico; - codigo antigo

    //exibe o primeiro registro (criação) com "Criado Por" e container principal
    let infos = "";


    //exibe os registro subsequentes (alterações) com "Alterado Por"
    for (his in historicos) {
        let historico = historicos[his]
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
            <div style="display: flex; align-items: center; justify-content: space-evenly; margin-bottom: 10px;">
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center; font-size: 0.8vw;">
                    <label><strong>Data: </strong>${historico.data}</label>
                    <label><strong>Status: </strong>${historico.status_manutencao}</label>
                    <label><strong>Usuário: </strong>${historico.usuario}</label>
                    <label><strong>Comentário: </strong></label>
                    <textarea style="width: 100%; background-color: white; border: 1px solid #ccc; padding: 5px; resize: none;" readonly>${historico.comentario}</textarea>
                </div>
                <img src="imagens/${imagem}.png" style="width: 50px; margin-left: 10px;">
            </div>
            <hr style="width: 100%;">
        `;
    }

    let elemento = `
        <br>
            
            <div style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px; width: 70vw; padding: 5px;">Histórico</div>

            <div style="width: 70vw; background-color: #d2d2d2; color: #222; padding: 5px;">
                ${infos}
            </div>
        `

    div_historico.insertAdjacentHTML('beforeend', elemento)



}

function salvarPrimeiroUsuario(historico) {

    // Verifica se o objeto de histórico existe e não está vazio
    if (historico && dicionario(historico)) {
        // Obtém a primeira chave do objeto
        const primeiraChave = Object.keys(historico)[0];
        // Retorna o nome do usuário do primeiro registro
        return historico[primeiraChave].usuario
    }
    // Retorna null se o histórico estiver vazio ou não existir
    return historico;
}

async function capturar_html_pdf(id) {

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let dados_clientes_omie = {}
    for (cnpj in dados_clientes) {
        dados_clientes_omie[dados_clientes[cnpj].omie] = dados_clientes[cnpj]
    }

    let manutencao = dados_manutencao[id]
    let campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    let pessoas = ['tecnico', 'cliente']
    let divs = ''

    pessoas.forEach(pessoa => {
        let elementos = ''
        let codigo = manutencao[`codigo_${pessoa}`]

        if (codigo !== '') {
            let dados = dados_clientes_omie[codigo] || {}

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
        linhas += `
        <tr>
            <td>${peca.partnumber || dados_estoque[peca.codigo].partnumber}</td>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario}</td>
            <td>${peca.descricao}</td>
        </tr>
        `
    }

    let tabela = `
        <label style="font-size: 1.5em;">REQUISIÇÃO ${manutencao.chamado}</label>
        <table>
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

    remover_popup()
    await abrir_manutencao(id)
}


async function criar_manutencao(id) {

    let acesso = JSON.parse(localStorage.getItem("acesso"))

    dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}

    let permissao = dados_setores[acesso.usuario].permissao

    let setor = dados_setores[acesso.usuario].setor

    let displayBotaoAnexos = ""

    if (permissao == "adm" || setor == "LOGÍSTICA") {

        displayBotaoAnexos = "flex"

    } else {

        displayBotaoAnexos = "none"

    }

    let termo = 'Editar'
    let botao = 'Atualizar'
    let pdf = `
        <div onclick="capturar_html_pdf('${id}')" class="contorno_botoes" style="background-color: #B12425; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <img src="imagens/pdf.png" style="cursor: pointer; width: 2vw;">
            <label>PDF</label>
        </div>
        `

    let excluir = `
        <div style="position: absolute; bottom: 0; left: 2vw; display: flex; justify-content: center; align-items: center; gap: 5px;" onclick="confirmar_exclusao('${id}')">
            <img src="imagens/cancel.png" style="cursor: pointer; width: 1vw;">
            <label style="font-size: 0.8vw; cursor: pointer;">Excluir Manutenção</label>
        </div>
    `

    if (id == undefined) {
        termo = 'Criar'
        botao = 'Enviar para Logística'
        pdf = ''
        excluir = ''
        id = gerar_id_5_digitos()
    }

    let acumulado = `
        <div style="position: relative;" id="tela">

            <div style="background-color: white; border-radius: 3px; padding: 5px; font-size: 0.9vw; width: 70vw;">

                <div style="position: relative; display: flex; align-items: center; justify-content: start; color: #222; background-color: #d2d2d2; padding: 5px; border-radius: 3px;">
                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">

                        <label style="font-size: 1.2vw;">Cliente | Loja</label>
                        <label id="codigo_cliente" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="cliente" oninput="sugestoes(this, 'sug_cliente', 'clientes')"
                                placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_cliente"></div>
                        </div>

                        <div id="endereco_cliente"
                            style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                        </div>

                    </div>

                    <div style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                        <label style="font-size: 1.2vw;">TÉCNICO</label>
                        <label id="codigo_tecnico" style="display: none"></label>
                        <div style="position: relative;">
                            <textarea type="text" id="tecnico" oninput="sugestoes(this, 'sug_tecnico', 'clientes')"
                                placeholder="..."></textarea>
                            <div class="autocomplete-list" id="sug_tecnico"></div>
                        </div>

                        <div id="endereco_tecnico"
                            style="display: flex; flex-direction: column; align-items: start; justify-content: start; gap: 3px;">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: start; gap: 5px;">
                        <div
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: start; gap: 20px;">
                            <label style="font-size: 1.2vw;">Status Manutenção</label>
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
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Kit Técnico</label>
                            <input id="kit" type="checkbox" style="width: 2vw; height: 2vw; cursor: pointer;"
                                onclick="alterar_kit(this)">
                        </div>
                        <div id="div_chamado"
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Chamado</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text"
                                placeholder="..." id="chamado">
                        </div>
                        <div id="div_previsao"
                            style="position: relative; width: 25vw; display: flex; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">Previsão</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="date"
                                placeholder="..." id="previsao">
                        </div>
                        <div id="div_NF"
                            style="display: none; position: relative; width: 25vw; align-items: center; justify-content: left; gap: 20px;">
                            <label style="font-size: 1.2vw;">NF</label>
                            <input style="font-size: 1.1vw; padding: 5px; border-radius: 3px; width: 10vw;" type="text"
                                placeholder="..." id="NF">
                        </div>
                        <div
                            style="position: relative; width: 25vw; display: flex; flex-direction: column; align-items: start;">
                            <label style="font-size: 1.2vw;">Comentário</label>
                            <textarea type="text" placeholder="..." id="comentario"></textarea>
                        </div>

                        <div style="display: flex; align-items; justify-content: center; align-items: center; gap: 5px;">
                            <label style="font-size: 1.2vw;">Anexos</label>
                            <label class="contorno_botoes" for="anexo_pedido" style="display: ${displayBotaoAnexos}; justify-content: center; border-radius: 50%;">
                                <img src="imagens/anexo.png" style="cursor: pointer; width: 1vw;">
                                <input type="file" id="anexo_pedido" style="display: none;" onchange="salvar_anexos_manutencao(this, '${id}')">
                            </label>
                        </div>
                        
                        <div id="lista-anexos" style="display: none; align-items: start; justify-content: start; flex-direction: column;"></div>
                    </div>

                </div>

                <br>

                <div class="tabela_manutencao">
                    <div class="linha"
                        style="background-color: #151749; color: white; border-top-left-radius: 3px; border-top-right-radius: 3px;">
                        <div style="width: 8vw;">
                            <label>Part Number</label>
                        </div>
                        <div style="width: 25vw;">
                            <label>Descrição</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Quantidade</label>
                        </div>
                        <div style="width: 20vw;">
                            <label>Comentário</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Estoque</label>
                        </div>
                        <div style="width: 10vw;">
                            <label>Estoque Usado</label>
                        </div>
                        <div style="width: 5vw;">
                            <label>Remover</label>
                        </div>
                    </div>

                    <div id="linhas_manutencao">
                        <div id="excluir_inicial" class="linha" style="width: 70vw;">
                            <label>Lista Vazia</label>
                        </div>
                    </div>

                </div>

                <br>

                <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
                    <div onclick="adicionar_linha_manut()" class="contorno_botoes"
                        style="background-color: #151749; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/chamados.png" style="cursor: pointer; width: 2vw;">
                        <label>Adicionar Peça</label>
                    </div>
                    <div onclick="enviar_manutencao('${id}')" class="contorno_botoes"
                        style="background-color: green; display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <img src="imagens/estoque.png" style="cursor: pointer; width: 2vw">
                        <label>${botao}</label>
                    </div>
                    ${pdf}
                    <div onclick="atualizar_base_clientes()" class="bex" style="background-color: brown; color: white;">
                        <img src="imagens/atualizar.png" style="cursor: pointer; width: 2vw;">
                        <label">Sincronizar Clientes/Técnicos</label>
                    </div>
                    <div onclick="recuperar_estoque()" class="bex" style="background-color: black; color: white;">
                        <img src="imagens/sync.png" style="cursor: pointer; width: 2vw;">
                        <label">Sincronizar Estoque</label>
                    </div>
                </div>

            </div>

        </div>

        <label id="data" style="position: absolute; bottom: 0; right: 1vw; font-size: 0.8vw;">${data_atual('completa')}</label>
        ${excluir}

        <div id="historico"></div>

    `

    openPopup_v2(acumulado, `${termo} Requisição de Materiais`)
}

function confirmar_exclusao(id) {

    openPopup_v2(`
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

    remover_popup()

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

    document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let campos = ['codigo_tecnico', 'codigo_cliente', 'comentario', 'status_manutencao', 'data', 'chamado']
    let manutencao = {}
    manutencao.usuario = acesso.usuario
    manutencao.analista = acesso.nome_completo

    let dados_manutencao = await recuperarDados('dados_manutencao') || {}

    manutencao.historico = dados_manutencao[id]?.historico || {}

    // Atualiza o status atual da requisição
    manutencao.status_manutencao = document.getElementById('status_manutencao').value;

    let previsao = document.getElementById('previsao');

    if (previsao && previsao.value) {
        // Converte "DD/MM/YYYY" para "YYYY-MM-DD" se necessário
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

    // Adiciona uma nova entrada ao histórico
    let novaAtualizacao = {
        data: data_atual("completa"),
        status_manutencao: manutencao.status_manutencao,
        usuario: manutencao.usuario,
        comentario: document.getElementById('comentario').value
    };

    // Gera uma chave única para a nova atualização
    let chaveAtualizacao = gerar_id_5_digitos();
    manutencao.historico[chaveAtualizacao] = novaAtualizacao;

    let tabela = document.getElementById('linhas_manutencao')
    let linhas = tabela.querySelectorAll('.linha')

    let pecas = {}
    linhas.forEach(linha => {
        let celulas = linha.querySelectorAll('input, textarea')
        if (celulas.length > 0) {
            pecas[gerar_id_5_digitos()] = {
                partnumber: celulas[0].value,
                descricao: celulas[1].value,
                codigo: celulas[2].value,
                quantidade: celulas[3].value,
                comentario: celulas[4].value
            }
        }
    })

    manutencao.pecas = pecas

    campos.forEach(campo => {
        let elemento = document.getElementById(campo)
        if (elemento) {
            manutencao[campo] = elemento.value || elemento.textContent
        }
    })

    let kit = document.getElementById('kit')
    if (kit.checked) {
        manutencao.chamado = 'KIT TÉCNICO'
    }

    enviar(`dados_manutencao/${id}`, manutencao)
    dados_manutencao[id] = manutencao

    await inserirDados(dados_manutencao, 'dados_manutencao')

    remover_popup()

    await carregar_manutencoes()

}

function adicionar_linha_manut() {
    let tbody = document.getElementById('linhas_manutencao')
    let aleatorio = gerar_id_5_digitos()

    let excluir_inicial = document.getElementById('excluir_inicial')
    if (excluir_inicial) {
        excluir_inicial.remove()
    }

    if (tbody) {
        let linha = `
        <div class="linha_completa">
            <div class="linha">
                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="text">
                </div>
                <div style="position: relative; width: 25vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;" type="text" id="${aleatorio}" oninput="sugestoes(this, 'sug_${aleatorio}', 'estoque')"></textarea>
                    <div class="autocomplete-list" id="sug_${aleatorio}"></div>
                    <input id="input_${aleatorio}" style="display: none;">
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" type="number">
                </div>

                <div style="width: 20vw; height: 30px; background-color: #b5b5b5;">
                    <textarea style="background-color: transparent;"></textarea>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 10vw; height: 30px; background-color: #b5b5b5;">
                    <input style="background-color: transparent; font-size: 1.0vw; width: 10vw; height: 30px;" readOnly>
                </div>

                <div style="width: 5vw;">
                    <img src="imagens/remover.png" onclick="remover_esta_linha(this)" style="width: 30px; cursor: pointer;">
                </div>
            </div>
            <hr style="width: 100%; margin: 0px;">
        </div>
        `
        tbody.insertAdjacentHTML('beforeend', linha)
    }
}

function remover_esta_linha(div_menor) {
    let linha_completa = div_menor.closest('.linha_completa')
    if (linha_completa) {
        linha_completa.remove()
    }
}

async function sugestoes(textarea, div, base) {

    let div_sugestoes = document.getElementById(div)
    let query = String(textarea.value).toUpperCase()
    div_sugestoes.innerHTML = '';

    if (query === '') {
        let campo = div.split('_')[1]
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

    for (id in dados) {
        let item = dados[id]
        let info;
        let dados_endereco;
        let cod_omie;

        if (base == 'clientes') {
            cod_omie = item.omie
            info = String(item.nome)
            dados_endereco = `
            <label><strong>CNPJ/CPF:</strong> ${item.cnpj}</label>
            <label style="text-align: left;"><strong>Rua/Bairro:</strong> ${item.bairro}</label>
            <label><strong>CEP:</strong> ${item.cep}</label>
            <label><strong>Cidade:</strong> ${item.cidade}</label>
            <label><strong>Estado:</strong> ${item.estado}</label>
        `.replace(/'/g, "&apos;")
                .replace(/"/g, "&quot;")
                .replace(/\r?\n|\r/g, "");

        } else if (base == 'estoque') {
            info = String(item.descricao)
        }

        if (info.includes(query)) {
            opcoes += `
                    <div onclick="definir_campo(this, '${div}', '${dados_endereco}', '${cod_omie}', '${id}')" class="autocomplete-item" style="font-size: 0.8vw;">${info}</div>
                `
        }
    }

    div_sugestoes.innerHTML = opcoes

}

async function definir_campo(elemento, div, string_html, omie, id) {

    let campo = String(div).split('_')[1]

    if (campo == 'tecnico' || campo == 'cliente') {

        let endereco = document.getElementById(`endereco_${campo}`)
        endereco.innerHTML = string_html.replace(/&apos;/g, "'").replace(/&quot;/g, '"');

    } else {

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
                } else if (historico.operacao == 'saida') {
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

    let codigo = document.getElementById(`codigo_${campo}`)
    if (codigo) {
        codigo.textContent = omie
    }
    document.getElementById(campo).value = elemento.textContent
    document.getElementById(div).innerHTML = '' // Sugestões
}

async function atualizar_base_clientes() {

    if (document.getElementById('tela')) {

        document.getElementById('tela').insertAdjacentHTML('beforeend', overlay_aguarde())

        await recuperar_clientes()

        let aguarde = document.getElementById('aguarde')
        if (aguarde) {
            aguarde.remove()
        }

    }

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

        let incluir = false;

        if (dataDe && dataAte) {
            incluir = (previsaoFormatada >= dataDe && previsaoFormatada <= dataAte);
        } else if (dataDe) {
            incluir = (previsaoFormatada >= dataDe);
        } else if (dataAte) {
            incluir = (previsaoFormatada <= dataAte);
        } else {
            incluir = true; // Se nenhuma data for selecionada, mostra tudo
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

    let anexos = await anexo_v2(input); // Simulação da função de upload
    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao');
    let dados_manutencoes = await recuperarDados('dados_manutencao') || {};

    let dados_manutencao = dados_manutencoes[id];

    // 🛑 Se o manutencao ainda não existe, salva os anexos temporariamente
    if (!dados_manutencao) {
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
    if (!dados_manutencao.anexos) {
        dados_manutencao.anexos = {};
    }

    anexos.forEach(anexo => {
        dados_manutencao.anexos[anexo.link] = anexo;
        enviar(`dados_manutencao/${id}/anexos/${anexo.link}`, anexo);
    });

    // Atualiza localmente
    await inserirDados(dados_manutencoes, 'dados_manutencao');

    // Recarrega os anexos no modal
    renderizarAnexos(id);
}

async function renderizarAnexos(id) {
    let listaAnexos = document.getElementById("lista-anexos");
    if (!listaAnexos) return;

    listaAnexos.style.display = 'flex'
    // 🔥 Recupera dados do banco
    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao');
    let dados_manutencoes = await recuperarDados('dados_manutencao') || {};

    let dados_manutencao = dados_manutencoes[id] || {}; // Se não existir, inicia vazio
    let anexosBanco = dados_manutencao.anexos || {}; // Anexos já salvos no banco
    let anexosPendentes = manutencoes_pendentes[id]?.anexos || {}; // Anexos pendentes

    // 🔹 Combina os anexos do banco e os pendentes
    let anexos = { ...anexosBanco, ...anexosPendentes };

    // 🔸 Se ainda não há anexos, exibir mensagem
    if (Object.keys(anexos).length === 0) {
        return;
    }

    // 🔹 Renderiza os anexos (banco + pendentes)
    listaAnexos.innerHTML = Object.values(anexos)
        .map(anexo => {
            let nomeFormatado = anexo.nome.length > 25
                ? `${anexo.nome.slice(0, 6)}...${anexo.nome.slice(-6)}`
                : anexo.nome;

            return `
            <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                <div style="cursor: pointer;" class="contorno_interno" onclick="abrirArquivo('${anexo.link}')">
                    <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                    <label title="${anexo.nome}">${nomeFormatado}</label>
                </div>
                <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="removerAnexo('${id}', '${anexo.link}')">
            </div>
            `;
        })
        .join("");
}

async function removerAnexo(id, linkAnexo) {

    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')
    let dados_manutencoes = await recuperarDados('dados_manutencao') || {}

    let dados_manutencao = dados_manutencoes[id]

    if (!dados_manutencao || !dados_manutencao.anexos || !dados_manutencao.anexos[linkAnexo]) return;

    // Remove da nuvem
    deletar(`dados_manutencao/${id}/anexos/${linkAnexo}`);

    await inserirDados(await receber('dados_manutencao'), 'dados_manutencao')

    // Atualiza a interface
    renderizarAnexos(id);
}

