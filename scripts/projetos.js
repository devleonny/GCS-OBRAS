var quadros = [
    'ORÇAMENTO',
    'MEETING - PLANEJAMENTO',
    'AGUARDANDO MATERIAL',
    'MATERIAL SEPARADO',
    'MATERIAL ENVIADO',
    'STAND BY',
    'MOBILIZAÇÃO',
    'START',
    'INFRA',
    'INSTALAÇÕES',
    'CONFIGURAÇÃO',
    'PENTE FINO',
    'CONCLUÍDA',
    'COM RETORNO',
    'FATURADO',
    'PAGAMENTO CONCLUÍDO'
];

inicializar()

function inicializar() {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {};

    document.getElementById('quadro').innerHTML = ''; // Limpar o quadro

    var acumulado = '';
    quadros.forEach(qd => {
        acumulado += `
        <div class="column">
            <label class="column-header">${qd}</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin: 10px;">
                <img src="/imagens/pesquisar.png" style="width: 25px; height: 25px;">
                <input id="pesquisar_${qd}" style="padding: 10px; border-radius: 5px;" placeholder="Pesquisar cartão" oninput="pesquisar_orcamento('${qd}')">
            </div>
            <div class="card-list" id="${qd}"></div>
        </div>`;
    });

    document.getElementById('quadro').insertAdjacentHTML('beforeend', acumulado);

    // Adiciona cartões aos quadros
    for (var chave_orcamento in dados_orcamentos) {
        var qd = 'ORÇAMENTO';
        if (dados_orcamentos[chave_orcamento].trello) {
            qd = dados_orcamentos[chave_orcamento].trello.quadro;
        }

        var tags = '';
        if (dados_orcamentos[chave_orcamento].etiqueta) {
            var etiquetas_orcamento = dados_orcamentos[chave_orcamento].etiqueta;
            Object.keys(etiquetas_orcamento).forEach(et => {
                var etiqueta = dados_etiquetas[et];
                tags += `<div class="contorno_botoes" style="background-color: ${etiqueta.cor}; border-radius: 2px;">${etiqueta.nome}</div>`;
            });
        }

        var elemento = `
        <div class="card" onclick="exibir_todos_os_status('${chave_orcamento}')">
            <div style="display: flex; font-size: 0.6em; flex-wrap: wrap;">${tags}</div>
            <label style="display: none;">${chave_orcamento}</label>
            ${dados_orcamentos[chave_orcamento].dados_orcam.contrato} - 
            ${dados_orcamentos[chave_orcamento].dados_orcam.cliente_selecionado}
        </div>`;

        document.getElementById(qd).insertAdjacentHTML('beforeend', elemento);
    }

    // Inicializa Sortable nos quadros uma única vez
    quadros.forEach(qd => {
        if (!Sortable.get(document.getElementById(qd))) {
            Sortable.create(document.getElementById(qd), {
                group: 'shared',
                animation: 50,
                handle: '.card',
                onEnd: posicao_cards // Atualiza posição no final do movimento
            });
        }
    });
}

function posicao_cards() {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};

    quadros.forEach(quadro => {
        var div_quadros = document.getElementById(quadro);
        var cards = div_quadros.querySelectorAll('div.card');

        cards.forEach((card, ordem_) => {
            var id = card.querySelector('label').textContent;
            var ja_possuia_trello = Boolean(dados_orcamentos[id].trello);

            // Verificação adicional para evitar duplicação
            if (quadro === 'ORÇAMENTO' && !ja_possuia_trello) return;

            if (!ja_possuia_trello || dados_orcamentos[id].trello.quadro !== quadro || dados_orcamentos[id].trello.posicao !== ordem_) {
                dados_orcamentos[id].trello = { posicao: ordem_, quadro: quadro };
                atualizar_trello(id, dados_orcamentos[id].trello);
            }
        });
    });

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos));
}


function pesquisar_orcamento(qd) {
    var quadro = document.getElementById(qd);
    var pesquisa = String(document.getElementById('pesquisar_' + qd).value).toLowerCase();

    if (quadro) {
        var divs = quadro.querySelectorAll('div.card');

        divs.forEach(div => {
            // Mostra o cartão apenas se corresponder à pesquisa ou se o campo de pesquisa estiver vazio
            div.style.display = String(div.textContent).toLowerCase().includes(pesquisa) || pesquisa == '' ? "block" : "none";
        });
    }
}


function atualizar_trello(id, trello){

    var dados = {
        'tabela': 'trello',
        'quadro': trello.quadro,
        'posicao': trello.posicao,
        'id': id
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}


async function recuperar_orcamentos_projetos() {

    carregamento('quadro')

    recuperar()

    return new Promise((resolve, reject) => {

        var url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=orcamentos';

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao carregar os dados');
                }
                return response.json();
            })
            .then(data => {
                var orcamentos = {};
                data.forEach(function (orcamento) {
                    let orcamento_parse = JSON.parse(orcamento);
                    let id_orcamento = orcamento_parse.id;
                    orcamentos[id_orcamento] = orcamento_parse;
                });

                localStorage.setItem('dados_orcamentos', JSON.stringify(orcamentos));

                inicializar()

            })
            .then(() => {
                resolve();
            })
            .catch(error => {
                console.error('Ocorreu um erro:', error);
                reject(error);
            });
    });
}