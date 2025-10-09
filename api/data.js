// Importa o cliente do Vercel KV
import { kv } from '@vercel/kv';

// Esta é a função principal que a Vercel vai executar
export default async function handler(request, response) {
    // Se a requisição for do tipo GET (buscar dados)
    if (request.method === 'GET') {
        try {
            // Tenta pegar os dados salvos na chave 'dashboardState'
            const savedState = await kv.get('dashboardState');
            // Se não houver nada salvo, retorna um objeto vazio
            if (!savedState) {
                return response.status(200).json({});
            }
            // Se encontrou, retorna os dados
            return response.status(200).json(savedState);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
            return response.status(500).json({ message: 'Erro ao buscar dados.' });
        }
    }

    // Se a requisição for do tipo POST (salvar dados)
    if (request.method === 'POST') {
        try {
            // Pega o estado enviado pelo front-end no corpo da requisição
            const newState = request.body;
            // Salva o novo estado na chave 'dashboardState'
            await kv.set('dashboardState', newState);
            // Responde com sucesso
            return response.status(200).json({ message: 'Dados salvos com sucesso!' });
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            return response.status(500).json({ message: 'Erro ao salvar dados.' });
        }
    }

    // Se for qualquer outro método (DELETE, PUT, etc.), retorna um erro.
    response.status(405).json({ message: 'Método não permitido.' });
}