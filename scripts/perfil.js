var dados_usuario = JSON.parse(localStorage.getItem('acesso'))

var lista = ['usuario', 'nome_completo', 'email', 'telefone']

lista.forEach(function (item) {

    document.getElementById(item).textContent = dados_usuario[item]
    
})