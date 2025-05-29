let filtroAlteracoes = {}
async function recuperarRegistros() {
    overlayAguarde()
    let registrosAlteracoes = await receber('registrosAlteracoes');
    console.log(registrosAlteracoes);

    await inserirDados(registrosAlteracoes, 'registrosAlteracoes');
    remover_popup()
}





carregarRegistros()
async function carregarRegistros() {
    const registrosAlteracoes = await recuperarDados('registrosAlteracoes') || {}
    console.log(registrosAlteracoes);

    let acumulado = '';
    let cabecalhos = ['Usuário', 'Data', 'Comentário', 'ID', 'Base']
    let thSearch = ''
    let thHead = ''
    let tabelaRegistro = document.getElementById('tabelaRegistro')
    let linhas = ''
    let bases = { Todos: {} }
    let toolbar = ''

    cabecalhos.forEach((cabecalho, i) => (
        thHead += `
        <th> ${cabecalho}</th>`,

        thSearch += `
        <th style="background-color: white">
            <div style="display: flex; justify-content:space-between; align-items: center">
                <input oninput="pesquisar_generico(${i}, this.value, filtroAlteracoes, 'bodyTabela' )" style="text-align: left; width: 100%">
                <img src="imagens/pesquisar2.png" style="width: 1vw;">
            </div>
        </th>`


    ));
    for ([id, registro] of Object.entries(registrosAlteracoes).reverse()) {
        linhas += `
            <tr>
                <td>${registro.usuario}</td>
                <td>${registro.data}</td>
                <td>${registro.comentario}</td>
                <td>${id}</td>
                <td>${registro.base}</td>
            </tr>
        `
        if (!bases[registro.base]) {
            bases[registro.base] = {}
        }
    }
    for (base in bases) {
        toolbar += `
            <div ${base === 'Todos' ? `style="background-color: #d2d2d2;"`: ''} class="divToolbar" onclick="filtrarRegistros('${base}', this)">
                <label>${inicial_maiuscula(String(base).replace('_', ' '))}</label>
            </div>

        `
    }

    let tabela = `
    <table class="tabela" style="width: 90vw;">
        <thead>
            <tr>
                ${thHead}
            </tr>
            <tr>
                ${thSearch}
            </tr>
        </thead>

        <tbody id="bodyTabela">
            ${linhas}
        </tbody>
    </table>
    `
    acumulado = `
    <br>
    <div id="toolbar" style="display: flex; align-items: end; justify-content: left; gap: 10px; height: 3vw; margin-left: 2vw;" >
        ${toolbar}
    </div>
    <div style="height: 80vh; overflow: auto;">
        ${tabela}
    </div>    
    `
    tabelaRegistro.innerHTML = acumulado

}


function filtrarRegistros(base, divElemento) {
    if (base === 'Todos') base = '' 
    pesquisar_generico(4, base, filtroAlteracoes, 'bodyTabela')
    let toolbar = document.getElementById('toolbar')
    let divs = toolbar.querySelectorAll('div')
    divs.forEach(div => {
        div.style.backgroundColor = '#797979';
    })
    divElemento.style.backgroundColor = ' #d2d2d2'
}