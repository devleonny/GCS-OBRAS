
nova_tabela_cotacoes()

function nova_tabela_cotacoes() {

    var acumulado = `
        <div style="position: relative">
            <div id="painel_cotacoes">

                <table style="border-collapse: collapse;">

                    <thead>
                        <th>Remover</th>
                        <th>Partnumber</th>
                        <th>Descrição</th>
                        <th>Unidade</th>
                        <th>Quantidade</th>
                        <th>Estoque</th>
                    </thead>
                    <tbody></tbody>

                </table>

            </div>

            <div style="display: flex; gap: 10px; position: absolute; bottom: -50px; left: 0;">
                <label style="border: 1px solid #888;" class="contorno_botoes"
                onclick="adicionar_linha_materiais()">Adicionar 1 item</label>

                <label style="background-color: green; border: 1px solid #888;" class="contorno_botoes"
                onclick="salvar_itens_adicionais()">Salvar</label>
            </div>
        </div>

        
    `

    document.body.insertAdjacentHTML('beforeend', acumulado)
}