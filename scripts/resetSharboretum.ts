import { Address, toNano } from '@ton/core';
import { Sharboretum } from '../wrappers/Sharboretum';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Sharboretum address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const sharboretum = provider.open(Sharboretum.createFromAddress(address));

    await sharboretum.sendReset(provider.sender(), {
        value: toNano('0.05'),
    });

    ui.write('Waiting for counter to reset...');

    let counterAfter = await sharboretum.getCounter();
    let attempt = 1;
    while (counterAfter !== 0) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        counterAfter = await sharboretum.getCounter();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter reset successfully!');
}
