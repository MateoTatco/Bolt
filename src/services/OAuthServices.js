async function placeholderFunction() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                token: 'placeholder_token',
                user: {
                    id: 'placeholder_id',
                    name: 'Placeholder User',
                    email: 'user@example.com',
                },
            })
        }, 500)
    })
}

export async function apiGoogleOauthSignIn() {
    return await placeholderFunction()
}

export async function apiGithubOauthSignIn() {
    return await placeholderFunction()
}
