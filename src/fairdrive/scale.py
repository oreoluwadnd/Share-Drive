def halving_score(amount, normal):
    """0 to 100: 100 when amount is 0, 50 when it equals normal, halving again for each further 'normal' amount."""
    return 100 * 0.5 ** (amount / normal)
