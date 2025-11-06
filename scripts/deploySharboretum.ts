import { toNano } from '@ton/core';
import { Sharboretum } from '../wrappers/Sharboretum';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const sharboretum = provider.open(
        Sharboretum.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('Sharboretum')
        )
    );

    await sharboretum.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(sharboretum.address);

    console.log('ID', await sharboretum.getID());
}
