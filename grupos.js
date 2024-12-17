recuperar()

carregar_grupos()

function fechar_popup() {
    document.getElementById('container_grupos').style.display = 'none'
}

async function atualizar_grupos() {

    var gif = document.getElementById('loading')
    var tabela = document.getElementById('ocultar')

    tabela.style.display = 'none'
    gif.style.display = 'flex'

    await recuperar()

    carregar_grupos()

    gif.style.display = 'none'
    tabela.style.display = ''
}

function carregar_grupos() {

    var grupos = JSON.parse(localStorage.getItem('dados_grupos'))
    var tabela = document.getElementById('tabela')

    tabela.innerHTML = ''

    Object.keys(grupos).forEach(function (grupo) {

        var tr = document.createElement('tr')
        var td = document.createElement('td')

        td.textContent = grupo
        tr.appendChild(td)

        var td = document.createElement('td')

        if (grupos[grupo]) {

            let itens = grupos[grupo].map(function (item, index) {
                return (index + 1) + ". " + (item);
            }).join("<br>");

            td.innerHTML = itens
        } else {
            td.textContent = '--'
        }
        tr.appendChild(td)

        var td = document.createElement('td')
        var img = document.createElement('img')
        img.src = 'editar.png'
        img.style.width = '15px'
        img.style.cursor = 'pointer'
        img.addEventListener('click', function () {
            document.getElementById('container_grupos').style.display = 'block'
            var tbody = document.getElementById('grupos')

            tbody.innerHTML = ''

            var tr = document.createElement('tr')
            var td = document.createElement('td')
            td.textContent = grupo
            td.id = 'grupo'
            tr.appendChild(td)

            var td = document.createElement('td')
            td.id = 'subgrupos'
            td.style.display = 'grid'

            grupos[grupo].forEach(function (item) {
                var input = document.createElement('input')
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

    var td = document.getElementById('subgrupos')

    var input = document.createElement('input')

    input.placeholder = 'Subgrupo'
    input.classList = 'input_subgrupos'

    td.appendChild(input)

}

function salvar_subgrupos() {
    var grupo = document.getElementById('grupo').textContent

    var dados_grupos = JSON.parse(localStorage.getItem('dados_grupos'))

    var subgrupos = document.getElementById('subgrupos')

    var inputs = subgrupos.querySelectorAll('input');

    var novos_subgrupos = []

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

    var resposta_api = {
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