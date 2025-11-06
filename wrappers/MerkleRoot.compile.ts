import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tolk',
    entrypoint: 'contracts/merkle_root.tolk',
    withStackComments: true,
    withSrcLineComments: true,
    experimentalOptions: '',
};
