# Hand-written: given_to becomes supplier_name (keeps existing data).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bnb', '0024_tilldrawing_method'),
    ]

    operations = [
        migrations.CreateModel(
            name='Supplier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('phone', models.CharField(blank=True, max_length=30)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('branch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='suppliers', to='bnb.branch')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddConstraint(
            model_name='supplier',
            constraint=models.UniqueConstraint(fields=('branch', 'name'), name='supplier_branch_name'),
        ),
        migrations.RenameField(
            model_name='expense',
            old_name='given_to',
            new_name='supplier_name',
        ),
        migrations.AlterField(
            model_name='expense',
            name='supplier_name',
            field=models.CharField(max_length=120, verbose_name='supplier / paid to'),
        ),
        migrations.AddField(
            model_name='expense',
            name='supplier_phone',
            field=models.CharField(blank=True, max_length=30, verbose_name='supplier phone'),
        ),
    ]
