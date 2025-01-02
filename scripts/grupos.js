recuperar()

carregar_grupos()

function fechar_popup() {

    document.getElementById('container_grupos').style.display = 'none'

}

async function atualizar_grupos() {

    let gif = document.getElementById('loading')
    let tabela = document.getElementById('ocultar')

    tabela.style.display = 'none'
    gif.style.display = 'flex'

    await recuperar()

    carregar_grupos()

    gif.style.display = 'none'
    tabela.style.display = ''

}

function carregar_grupos() {

    let grupos = JSON.parse(localStorage.getItem('dados_grupos'))
    let tabela = document.getElementById('tabela')

    tabela.innerHTML = ''

    Object.keys(grupos).forEach(function (grupo) {

        let tr = document.createElement('tr')
        let td = document.createElement('td')

        td.textContent = grupo
        tr.appendChild(td)

        td = document.createElement('td')

        if (grupos[grupo]) {

            let itens = grupos[grupo].map(function (item, index) {

                return (index + 1) + ". " + (item);

            }).join("<br>");

            td.innerHTML = itens

        } else {

            td.textContent = '--'

        }
        tr.appendChild(td)

        td = document.createElement('td')
        let img = document.createElement('img')
        img.src = "/imagens/editar.png"
        img.style.width = '15px'
        img.style.cursor = 'pointer'
        img.addEventListener('click', function () {

            document.getElementById('container_grupos').style.display = 'block'
            let tbody = document.getElementById('grupos')

            tbody.innerHTML = ''

            let tr = document.createElement('tr')
            let td = document.createElement('td')
            td.textContent = grupo
            td.id = 'grupo'
            tr.appendChild(td)

            td = document.createElement('td')
            td.id = 'subgrupos'
            td.style.display = 'grid'

            grupos[grupo].forEach(function (item) {

                let input = document.createElement('input')
                input.classList = 'input_subgrupos'
                input.value = item
                td.appendChild(input)

            })

            tr.appendChild(td)

            tbody.appendChild(tr)

        })

        td.appendChild(img)
        tr.appendChild(td)

        tabela.appendChild(tr)

    })


}

function adicionar() {

    let td = document.getElementById('subgrupos')

    let input = document.createElement('input')

    input.placeholder = 'Subgrupo'
    input.classList = 'input_subgrupos'

    td.appendChild(input)

}

function salvar_subgrupos() {

    let grupo = document.getElementById('grupo').textContent

    let dados_grupos = JSON.parse(localStorage.getItem('dados_grupos'))

    let subgrupos = document.getElementById('subgrupos')

    let inputs = subgrupos.querySelectorAll('input');

    let novos_subgrupos = []

    inputs.forEach(function (input) {

        if (input.value !== '') {

            novos_subgrupos.push(input.value)

        }

    })

    if (dados_grupos[grupo]) {

        dados_grupos[grupo] = novos_subgrupos

    }

    localStorage.setItem('dados_grupos', JSON.stringify(dados_grupos))

    enviar_grupos(JSON.stringify(dados_grupos))

    openPopup('Salvo')

    fechar_popup()

    carregar_grupos()

}


function enviar_grupos(grupos) {

    let resposta_api = {

        'tabela': 'grupos',
        'grupos': grupos
        
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {

        method: 'POST',
        mode: 'no-cors',
        headers: {

            'Content-Type': 'application/json'

        },

        body: JSON.stringify(resposta_api)

    })

}