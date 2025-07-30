import { DAppKitUI } from '@vechain/dapp-kit-ui';

const walletConnectProjectId = '5c6a3589d71c0f5c26640cba7f9e44d3';

const dappKit = DAppKitUI.configure({
    node: 'https://testnet.vechain.org/',
    network: 'test',
    walletConnectOptions: {
        projectId: walletConnectProjectId,
        metadata: { name: 'DApp Kit Test', description: 'Test', url: window.location.origin, icons: [] }
    },
});

dappKit.wallet.subscribe(newState => {
    const addressDiv = document.getElementById('address');
    if (newState.address) {
        addressDiv.innerText = `Connected: ${newState.address}`;
    } else {
        addressDiv.innerText = 'Disconnected';
    }
});
