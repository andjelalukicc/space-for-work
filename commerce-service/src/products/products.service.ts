import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';
import { QueryProductsDto } from './dto/query-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const SEED: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'hot-desk',
    name: 'Hot Desk',
    category: 'Članstvo',
    price: '120',
    unit: 'mesec',
    featured: true,
    shortDescription:
      'Fleksibilno radno mesto u open space zonama uz networking i sve zajedničke pogodnosti.',
    tags: ['open space', 'wifi', 'kuhinja'],
    stockQuantity: 500,
    isActive: true,
  },
  {
    slug: 'dedicated-desk',
    name: 'Dedicated Desk',
    category: 'Članstvo',
    price: '180',
    unit: 'mesec',
    featured: false,
    shortDescription:
      'Lično rezervisano mesto u coworking prostoru i zaključavanje fioka za stalno prisustvo.',
    tags: ['personal desk', 'storage'],
    stockQuantity: 80,
    isActive: true,
  },
  {
    slug: 'team-office',
    name: 'Private Team Office',
    category: 'Članstvo',
    price: '450',
    unit: 'mesec',
    featured: false,
    shortDescription:
      'Privatna kancelarija za timove do 6 ljudi sa kombinovanim Hot Desk pristupom.',
    tags: ['tim', 'privatnost'],
    stockQuantity: 10,
    isActive: true,
  },
  {
    slug: 'meeting-room',
    name: 'Meeting Room',
    category: 'Rezervacije',
    price: '10',
    unit: 'sat',
    featured: false,
    shortDescription:
      'Sala za sastanke po satu ili danu, sa TV ekranom i belom tablom.',
    tags: ['10 eur/h', 'TV + tabla'],
    stockQuantity: 200,
    isActive: true,
  },
  {
    slug: 'event-space',
    name: 'Event Space',
    category: 'Event',
    price: '100',
    unit: '1 dan',
    featured: false,
    shortDescription: 'Prostor za radionice i meetupe do 100 ljudi.',
    tags: ['vikend', 'setup'],
    stockQuantity: 30,
    isActive: true,
  },
  {
    slug: 'virtual-office-pr',
    name: 'Virtual Office PR',
    category: 'Virtual Office',
    price: '30',
    unit: 'mesec',
    featured: true,
    shortDescription:
      'Poslovna adresa za preduzetnike, prijem pošte i APR podrška.',
    tags: ['min. 3 meseca', 'posta'],
    stockQuantity: 200,
    isActive: true,
  },
  {
    slug: 'virtual-office-doo',
    name: 'Virtual Office DOO',
    category: 'Virtual Office',
    price: '45',
    unit: 'mesec',
    featured: false,
    shortDescription:
      'Virtual Office za DOO sa adresom, ugovorom i prijemom pošte.',
    tags: ['min. 3 meseca', 'ugovor'],
    stockQuantity: 150,
    isActive: true,
  },
];

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count > 0) return;
    for (const row of SEED) {
      await this.repo.save(this.repo.create(row));
    }
    console.log(`Commerce: seeded ${SEED.length} products`);
  }

  async findPaginated(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const rawSort = query.sort ?? 'name';
    const sortCol = ['name', 'price', 'createdAt'].includes(rawSort)
      ? rawSort
      : 'name';
    const order = (query.order ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true });
    if (query.search?.trim()) {
      qb.andWhere(
        '(p.name ILIKE :s OR p.slug ILIKE :s OR p.category ILIKE :s)',
        { s: `%${query.search.trim()}%` },
      );
    }
    qb.orderBy(`p.${sortCol}`, order);
    qb.skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<Product> {
    const p = await this.repo.findOne({ where: { id, isActive: true } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const exists = await this.repo.findOne({ where: { slug: dto.slug } });
    if (exists) throw new ConflictException('Slug already exists');
    return this.repo.save(
      this.repo.create({
        ...dto,
        tags: dto.tags ?? [],
        category: dto.category ?? 'Usluga',
        unit: dto.unit ?? 'kom',
        featured: dto.featured ?? false,
        stockQuantity: dto.stockQuantity ?? 9999,
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    if (dto.slug && dto.slug !== p.slug) {
      const clash = await this.repo.findOne({ where: { slug: dto.slug } });
      if (clash) throw new ConflictException('Slug already exists');
    }
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async remove(id: string): Promise<void> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    p.isActive = false;
    await this.repo.save(p);
  }

  /** Internal: load product row for checkout (ignores isActive for validation elsewhere). */
  async findByIdForOrder(productId: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id: productId } });
  }
}
