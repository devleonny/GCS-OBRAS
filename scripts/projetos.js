let quadros = [

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

    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    let dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {};

    document.getElementById('quadro').innerHTML = '';

    let acumulado = '';
    quadros.forEach(qd => {

        acumulado += 
        
        `

        <div class="column">
            <label class="column-header">${qd}</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin: 10px;">
                <img src="/imagens/pesquisar.png" style="width: 25px; height: 25px;">
                <input id="pesquisar_${qd}" style="padding: 10px; border-radius: 5px;" placeholder="Pesquisar cartão" oninput="pesquisar_orcamento('${qd}')">
            </div>
            <div class="card-list" id="${qd}"></div>
        </div>
        
        `;

    });

    document.getElementById('quadro').insertAdjacentHTML('beforeend', acumulado);

    for (let chave_orcamento in dados_orcamentos) {

        let qd = 'ORÇAMENTO';

        if (dados_orcamentos[chave_orcamento].trello) {

            qd = dados_orcamentos[chave_orcamento].trello.quadro;

        }

        let tags = '';

        if (dados_orcamentos[chave_orcamento].etiqueta) {

            let etiquetas_orcamento = dados_orcamentos[chave_orcamento].etiqueta;

            Object.keys(etiquetas_orcamento).forEach(et => {

                let etiqueta = dados_etiquetas[et];
                tags += `<div class="contorno_botoes" style="background-color: ${etiqueta.cor}; border-radius: 2px;">${etiqueta.nome}</div>`;

            });

        }

        let elemento = 
        
        `

        <div class="card" onclick="exibir_todos_os_status('${chave_orcamento}')">
            <div style="display: flex; font-size: 0.6em; flex-wrap: wrap;">${tags}</div>
            <label style="display: none;">${chave_orcamento}</label>
            ${dados_orcamentos[chave_orcamento].dados_orcam.contrato} - 
            ${dados_orcamentos[chave_orcamento].dados_orcam.cliente_selecionado}
        </div>
        
        `;

        document.getElementById(qd).insertAdjacentHTML('beforeend', elemento);
    }

    quadros.forEach(qd => {

        if (!Sortable.get(document.getElementById(qd))) {

            Sortable.create(document.getElementById(qd), {

                group: 'shared',
                animation: 50,
                handle: '.card',
                onEnd: posicao_cards

            });

        }

    });

}

function posicao_cards() {

    let dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};

    quadros.forEach(quadro => {

        let div_quadros = document.getElementById(quadro);
        let cards = div_quadros.querySelectorAll('div.card');

        cards.forEach((card, ordem_) => {

            let id = card.querySelector('label').textContent;
            let ja_possuia_trello = Boolean(dados_orcamentos[id].trello);

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

    let quadro = document.getElementById(qd);
    let pesquisa = String(document.getElementById('pesquisar_' + qd).value).toLowerCase();

    if (quadro) {

        let divs = quadro.querySelectorAll('div.card');

        divs.forEach(div => {

            div.style.display = String(div.textContent).toLowerCase().includes(pesquisa) || pesquisa == '' ? "block" : "none";

        });

    }

}


function atualizar_trello(id, trello){

    let dados = {

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

        let url = 'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=orcamentos';

        fetch(url)

            .then(response => {

                if (!response.ok) {

                    throw new Error('Erro ao carregar os dados');

                }

                return response.json();

            })

            .then(data => {

                let orcamentos = {};

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